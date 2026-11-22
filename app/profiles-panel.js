/* Local Profile Library panel: snapshot export, diff preview, and safe apply via official #fileInput. */
(() => {
  'use strict';

  const PRESET_TAGS = ['FPS', '办公', 'MOBA', '防误触', '低行程 RT'];
  const ICON_SVG = '<path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M8 4v5h8V4M8 20v-7h8v7"/>';

  function mountProfilesPanel() {
    const shell = window.thunder68Shell;
    const core = window.thunder68ProfileCore;
    const api = window.thunder68Local?.profiles;
    if (!shell || !core || !api) return;

    let container = null;
    let summaries = [];
    let selectedTags = new Set(['FPS']);
    let applying = false;
    let applyWatchTimer = null;
    let diffLeftId = '__live__';
    let diffRightId = '';

    const getLiveConfig = () => window.thunder68Presentation?.state()?.config || null;
    const isLiveConfigReady = () => {
      const status = shell.getStatus();
      const cfg = getLiveConfig();
      return Boolean(status.deviceOpened && cfg && Array.isArray(cfg.keyValues) && cfg.keyValues.length === 68 && !cfg.mask);
    };

    function formatTime(iso) {
      if (!iso) return '--';
      try {
        return new Date(iso).toLocaleString('zh-CN', {hour12: false});
      } catch {
        return iso;
      }
    }

    function setBanner(kind, message, showVerifyAction = false) {
      if (!container) return;
      const box = container.querySelector('.local-profiles-banner');
      if (!box) return;
      if (!message) {
        box.hidden = true;
        box.replaceChildren();
        return;
      }
      box.hidden = false;
      box.dataset.kind = kind || 'info';
      box.replaceChildren();
      const span = document.createElement('span');
      span.textContent = message;
      box.appendChild(span);
      if (showVerifyAction) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'local-btn-primary';
        btn.textContent = '重新读取核对';
        btn.addEventListener('click', () => {
          shell.exitTool();
          shell.triggerVerify();
        });
        box.appendChild(btn);
      }
    }

    async function loadConfigByChoice(choiceId) {
      if (choiceId === '__live__') {
        const cfg = getLiveConfig();
        return cfg ? core.sanitizeProfileConfig(cfg) : null;
      }
      if (!choiceId) return null;
      const full = await api.get(choiceId);
      return full?.config || null;
    }

    async function applyProfileById(id) {
      if (applying) {
        const msg = '正在应用方案中，请等待当前写入完成。';
        shell.feedback(msg, 'error');
        setBanner('error', msg);
        return {ok: false, error: msg};
      }
      const status = shell.getStatus();
      const liveConfig = getLiveConfig();
      if (!status.deviceOpened || !liveConfig) {
        const msg = '请先连接雷电68 并读取完当前 68 键配置后再应用方案。';
        shell.feedback(msg, 'error');
        setBanner('error', msg);
        return {ok: false, error: msg};
      }
      if (liveConfig.mask) {
        const msg = '键盘当前正在读写处理中（config.mask 忙态），已阻止并发写入。';
        shell.feedback(msg, 'error');
        setBanner('error', msg);
        return {ok: false, error: msg};
      }
      if (!Array.isArray(liveConfig.keyValues) || liveConfig.keyValues.length !== 68) {
        const msg = '当前键盘 68 键配置尚未读取完整，请稍候再试。';
        shell.feedback(msg, 'error');
        setBanner('error', msg);
        return {ok: false, error: msg};
      }

      const full = await api.get(id);
      if (!full || !full.config) {
        const msg = '读取目标方案失败或方案不存在。';
        shell.feedback(msg, 'error');
        setBanner('error', msg);
        return {ok: false, error: msg};
      }

      const validation = core.validateProfileConfig(full.config);
      if (!validation.valid) {
        const msg = `方案校验未通过：${validation.errors.join('；')}`;
        shell.feedback(msg, 'error');
        setBanner('error', msg);
        return {ok: false, error: msg};
      }

      const fileInput = document.querySelector('#root #fileInput');
      if (!fileInput) {
        const msg = '未找到官方导入控件 #fileInput，请确认已进入键盘配置界面。';
        shell.feedback(msg, 'error');
        setBanner('error', msg);
        return {ok: false, error: msg};
      }

      applying = true;
      updateConnectDependentUi();
      setBanner('info', `正在备份当前配置并写入方案「${full.name}」… 写入期间请勿断开键盘。`);
      shell.feedback(`正在应用方案「${full.name}」…`);

      // Step 1: Always capture an automatic rollback snapshot unless we are restoring the rollback itself.
      if (id !== core.ROLLBACK_PROFILE_ID) {
        const rollbackResult = await api.save({
          id: core.ROLLBACK_PROFILE_ID,
          name: `自动回滚快照（切换「${full.name}」前）`,
          tags: ['自动回滚'],
          notes: `应用方案 ${full.name} 前自动保留的 68 键配置快照`,
          source: 'rollback',
          config: core.sanitizeProfileConfig(liveConfig)
        });
        if (!rollbackResult?.ok) {
          applying = false;
          updateConnectDependentUi();
          const msg = '写入前创建自动回滚快照失败，已中止应用以保护当前配置。';
          shell.feedback(msg, 'error');
          setBanner('error', msg);
          return {ok: false, error: msg};
        }
      }

      // Step 2: Build official-compatible payload and trigger native #fileInput -> USER_IMPORT_WHOLE_CONFIG.
      try {
        const payload = core.buildOfficialImportPayload(full.config, liveConfig);
        const file = new File(
          [JSON.stringify(payload)],
          `${full.id}.json`,
          {type: 'application/json'}
        );
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', {bubbles: true}));
      } catch (error) {
        applying = false;
        updateConnectDependentUi();
        const msg = `触发官方导入通道失败：${error.message}`;
        shell.feedback(msg, 'error');
        setBanner('error', msg);
        return {ok: false, error: msg};
      }

      window.thunder68Local?.diagnostic?.({event: 'profile-apply-dispatched', name: full.id});

      // Step 3: Wait until official config.mask settles (or short settle delay) then guide re-read verify.
      clearInterval(applyWatchTimer);
      const startedAt = Date.now();
      let sawMask = false;
      applyWatchTimer = setInterval(() => {
        const cfg = getLiveConfig();
        const busy = Boolean(cfg?.mask);
        if (busy) sawMask = true;
        const elapsed = Date.now() - startedAt;
        const settled = (sawMask && !busy && elapsed > 800) || (!sawMask && elapsed > 2200) || elapsed > 20000;
        if (settled) {
          clearInterval(applyWatchTimer);
          applyWatchTimer = null;
          applying = false;
          updateConnectDependentUi();
          refresh();
          const doneMsg = `方案「${full.name}」已通过官方整机导入通道下发。建议立即点击「重新读取核对」确认固件实际生效值。`;
          shell.feedback(`方案「${full.name}」已写入 · 建议点击「重新读取核对」`, 'success');
          setBanner('success', doneMsg, true);
        }
      }, 250);

      return {ok: true, profileName: full.name};
    }

    async function renderDiff() {
      if (!container) return;
      const out = container.querySelector('.local-diff-output');
      const leftSelect = container.querySelector('.local-diff-left');
      const rightSelect = container.querySelector('.local-diff-right');
      if (!out || !leftSelect || !rightSelect) return;

      const leftVal = leftSelect.value;
      const rightVal = rightSelect.value;
      diffLeftId = leftVal;
      diffRightId = rightVal;

      if (!leftVal || !rightVal) {
        out.innerHTML = '<p class="local-muted-note">请选择两套方案（或当前键盘配置与某方案）查看键程、RT 与改键差异。</p>';
        return;
      }
      if (leftVal === rightVal) {
        out.innerHTML = '<p class="local-muted-note">两侧选择了同一份配置，请选择不同的方案进行对比。</p>';
        return;
      }

      const [cfgA, cfgB] = await Promise.all([loadConfigByChoice(leftVal), loadConfigByChoice(rightVal)]);
      if (!cfgA || !cfgB) {
        out.innerHTML = '<p class="local-muted-note">其中一侧配置尚未就绪（若选择了「当前键盘实时配置」，请先连接键盘）。</p>';
        return;
      }

      const diff = core.diffProfileConfigs(cfgA, cfgB);
      out.replaceChildren();

      const summary = document.createElement('div');
      summary.className = 'local-diff-summary';
      summary.textContent = diff.summaryText;
      out.appendChild(summary);

      if (!diff.hasChanges) return;

      const addSection = (title, rows, columns) => {
        if (!rows.length) return;
        const sec = document.createElement('div');
        sec.className = 'local-diff-block';
        const h4 = document.createElement('h4');
        h4.textContent = `${title}（${rows.length}）`;
        sec.appendChild(h4);

        const table = document.createElement('table');
        table.className = 'local-diff-table';
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        for (const col of columns) {
          const th = document.createElement('th');
          th.textContent = col;
          headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const cells of rows.slice(0, 80)) {
          const tr = document.createElement('tr');
          for (const val of cells) {
            const td = document.createElement('td');
            td.textContent = String(val);
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        sec.appendChild(table);
        out.appendChild(sec);
      };

      const mm = v => v === null || v === undefined ? '--' : `${Number(v).toFixed(2)} mm`;
      addSection(
        '触发行程差异',
        diff.travelChanges.map(item => [item.id, mm(item.from), mm(item.to)]),
        ['按键', '方案 A', '方案 B']
      );

      addSection(
        '快速触发 RT 差异',
        diff.rtChanges.map(item => {
          const fmt = (en, indep, sens, trig, rst) => !en
            ? '关闭'
            : indep ? `开启（按 ${mm(trig)} / 抬 ${mm(rst)}）` : `开启（${mm(sens)}）`;
          return [
            item.id,
            fmt(item.fromEnabled, item.fromIndependent, item.fromSensitivity, item.fromTrigger, item.fromReset),
            fmt(item.toEnabled, item.toIndependent, item.toSensitivity, item.toTrigger, item.toReset)
          ];
        }),
        ['按键', '方案 A', '方案 B']
      );

      addSection(
        '改键差异',
        diff.remapChanges.map(item => [`Layer ${item.layer + 1} · ${item.id}`, item.fromName, item.toName]),
        ['层 / 按键', '方案 A', '方案 B']
      );

      addSection(
        '灯效差异',
        diff.lightingChanges.map(item => [item.label, String(item.from ?? '--'), String(item.to ?? '--')]),
        ['参数', '方案 A', '方案 B']
      );

      addSection(
        '超级按键差异',
        diff.superkeyChanges.map(item => [item.label, `${item.fromCount} 组`, `${item.toCount} 组`]),
        ['类型', '方案 A', '方案 B']
      );

      addSection(
        '宏定义差异',
        diff.macroChanges.map(item => [item.name, `${item.fromActions} 步`, `${item.toActions} 步`]),
        ['宏槽位', '方案 A', '方案 B']
      );
    }

    function updateConnectDependentUi() {
      if (!container) return;
      const canLive = isLiveConfigReady() && !applying;
      const saveBtn = container.querySelector('.local-profile-save-btn');
      const liveHint = container.querySelector('.local-profile-live-hint');
      if (saveBtn) saveBtn.disabled = !canLive;
      if (liveHint) {
        const status = shell.getStatus();
        liveHint.textContent = applying
          ? '正在通过官方整机导入通道写入方案，请稍候…'
          : canLive
            ? '已连接 68 键配置：可捕获快照、与本地库对比，或一键写入（自动留存回滚快照）。'
            : status.deviceOpened
              ? '正在等待 68 键配置稳定读取或当前处于忙态…'
              : '未连接键盘：当前可离线浏览、导入/导出及对比已有方案；连接键盘后即可捕获与应用。';
      }
      for (const btn of container.querySelectorAll('.local-profile-apply-btn')) {
        btn.disabled = !canLive;
      }
    }

    function renderProfileList() {
      if (!container) return;
      const rollbackSlot = container.querySelector('.local-rollback-slot');
      const grid = container.querySelector('.local-profiles-grid');
      const leftSelect = container.querySelector('.local-diff-left');
      const rightSelect = container.querySelector('.local-diff-right');

      const rollback = summaries.find(item => item.isRollback);
      const regular = summaries.filter(item => !item.isRollback);

      rollbackSlot.replaceChildren();
      if (rollback) {
        rollbackSlot.hidden = false;
        const bar = document.createElement('div');
        bar.className = 'local-rollback-bar';
        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = rollback.name;
        const meta = document.createElement('span');
        meta.textContent = `留存时间：${formatTime(rollback.updatedAt)} · 平均行程 ${rollback.summary?.avgTravel ?? '--'} mm · RT ${rollback.summary?.rtEnabledCount ?? 0} 键`;
        info.append(title, meta);

        const actions = document.createElement('div');
        actions.className = 'local-rollback-actions';
        const cmpBtn = document.createElement('button');
        cmpBtn.type = 'button';
        cmpBtn.className = 'local-btn-secondary';
        cmpBtn.textContent = '对比当前';
        cmpBtn.addEventListener('click', () => {
          leftSelect.value = '__live__';
          rightSelect.value = rollback.id;
          renderDiff();
        });
        const restoreBtn = document.createElement('button');
        restoreBtn.type = 'button';
        restoreBtn.className = 'local-btn-primary local-profile-apply-btn';
        restoreBtn.textContent = '回滚此快照';
        restoreBtn.addEventListener('click', () => applyProfileById(rollback.id));
        actions.append(cmpBtn, restoreBtn);
        bar.append(info, actions);
        rollbackSlot.appendChild(bar);
      } else {
        rollbackSlot.hidden = true;
      }

      grid.replaceChildren();
      if (!regular.length) {
        const empty = document.createElement('div');
        empty.className = 'local-empty-card';
        empty.textContent = '方案库尚无已保存方案。连接键盘后可捕获当前配置，或点击上方「导入 JSON 方案」加载已有文件。';
        grid.appendChild(empty);
      } else {
        for (const item of regular) {
          const card = document.createElement('article');
          card.className = 'local-profile-card';

          const top = document.createElement('div');
          top.className = 'local-profile-card-head';
          const h3 = document.createElement('h3');
          h3.textContent = item.name;
          const timeEl = document.createElement('span');
          timeEl.className = 'local-profile-time';
          timeEl.textContent = formatTime(item.updatedAt);
          top.append(h3, timeEl);

          const tagsRow = document.createElement('div');
          tagsRow.className = 'local-profile-tags';
          for (const tag of item.tags || []) {
            const chip = document.createElement('span');
            chip.textContent = tag;
            tagsRow.appendChild(chip);
          }

          const stats = document.createElement('div');
          stats.className = 'local-profile-stats';
          const s = item.summary || {};
          for (const text of [
            `行程 ${s.minTravel ?? '--'}–${s.maxTravel ?? '--'} mm (均 ${s.avgTravel ?? '--'})`,
            `RT ${s.rtEnabledCount ?? 0} 键`,
            `改键 ${s.remapCount ?? 0}`,
            `超级键 ${s.superkeyCount ?? 0}`
          ]) {
            const badge = document.createElement('span');
            badge.textContent = text;
            stats.appendChild(badge);
          }

          const noteEl = document.createElement('p');
          noteEl.className = 'local-profile-notes';
          noteEl.textContent = item.notes || '';
          noteEl.hidden = !item.notes;

          const actions = document.createElement('div');
          actions.className = 'local-profile-actions';

          const applyBtn = document.createElement('button');
          applyBtn.type = 'button';
          applyBtn.className = 'local-btn-primary local-profile-apply-btn';
          applyBtn.textContent = '应用到键盘';
          applyBtn.addEventListener('click', () => applyProfileById(item.id));

          const diffBtn = document.createElement('button');
          diffBtn.type = 'button';
          diffBtn.className = 'local-btn-secondary';
          diffBtn.textContent = '对比';
          diffBtn.addEventListener('click', () => {
            leftSelect.value = isLiveConfigReady() ? '__live__' : (regular[0]?.id === item.id && regular[1] ? regular[1].id : regular[0]?.id || '');
            rightSelect.value = item.id;
            renderDiff();
            container.querySelector('.local-diff-card')?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
          });

          const exportBtn = document.createElement('button');
          exportBtn.type = 'button';
          exportBtn.className = 'local-btn-secondary';
          exportBtn.textContent = '导出';
          exportBtn.addEventListener('click', async () => {
            const res = await api.exportFile({id: item.id, format: 'profile'});
            if (res?.ok) setBanner('success', `已导出方案「${item.name}」为标准 JSON 文件。`);
            else if (res && !res.canceled) setBanner('error', res.error || '导出失败。');
          });

          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'local-btn-danger';
          delBtn.textContent = '删除';
          delBtn.addEventListener('click', async () => {
            const res = await api.remove(item.id);
            if (res?.ok) {
              setBanner('info', `已删除方案「${item.name}」。`);
              await refresh();
            }
          });

          actions.append(applyBtn, diffBtn, exportBtn, delBtn);
          card.append(top, tagsRow, stats, noteEl, actions);
          grid.appendChild(card);
        }
      }

      // Populate Diff selectors
      const options = [
        {value: '__live__', label: '当前键盘实时配置（连接态）'},
        ...summaries.map(item => ({value: item.id, label: `${item.isRollback ? '[回滚] ' : ''}${item.name}`}))
      ];
      for (const [sel, savedVal] of [[leftSelect, diffLeftId], [rightSelect, diffRightId]]) {
        sel.replaceChildren();
        for (const opt of options) {
          const el = document.createElement('option');
          el.value = opt.value;
          el.textContent = opt.label;
          sel.appendChild(el);
        }
        if (options.some(o => o.value === savedVal)) {
          sel.value = savedVal;
        } else if (sel === rightSelect && summaries.length) {
          sel.value = summaries[0].id;
        }
      }

      updateConnectDependentUi();
      renderDiff();
    }

    async function refresh() {
      try {
        summaries = await api.list();
      } catch {
        summaries = [];
      }
      renderProfileList();
      return summaries;
    }

    shell.registerTool({
      id: 'profiles',
      label: '配置方案库',
      iconSvg: ICON_SVG,
      title: '本地配置方案库',
      subtitle: '导出只读配置快照、对比两套方案键程/RT/改键差异，并通过官方原通道一键切换（写入前自动保存回滚快照）。',
      render(mountEl) {
        container = mountEl;
        mountEl.innerHTML = `
          <div class="local-profiles-layout">
            <div class="local-profiles-banner" role="status" hidden></div>
            <section class="local-companion-card local-profile-capture-card">
              <div class="local-card-row-head">
                <div>
                  <h2>保存当前配置快照</h2>
                  <p class="local-profile-live-hint"></p>
                </div>
                <button type="button" class="local-btn-secondary local-profile-import-btn">导入 JSON 方案…</button>
              </div>
              <div class="local-profile-form">
                <input type="text" class="local-profile-name-input" maxlength="60" placeholder="方案名称，例如：Valorant 0.1mm 极速 / 办公防误触" aria-label="方案名称">
                <input type="text" class="local-profile-notes-input" maxlength="200" placeholder="可选备注（如适用游戏、灯光说明）" aria-label="方案备注">
                <button type="button" class="local-btn-primary local-profile-save-btn">保存当前配置为方案</button>
              </div>
              <div class="local-tag-picker" role="group" aria-label="场景标签">
                <span>场景标签：</span>
                ${PRESET_TAGS.map(tag => `<button type="button" class="local-tag-chip${selectedTags.has(tag) ? ' is-selected' : ''}" data-tag="${tag}">${tag}</button>`).join('')}
              </div>
            </section>
            <div class="local-rollback-slot" hidden></div>
            <section class="local-companion-card">
              <div class="local-card-row-head">
                <h2>已保存方案</h2>
                <span class="local-muted-note">存储于本地 data/profiles/ · 写入复用官方原生 #fileInput</span>
              </div>
              <div class="local-profiles-grid"></div>
            </section>
            <section class="local-companion-card local-diff-card">
              <div class="local-card-row-head">
                <h2>方案差异对比（Diff）</h2>
                <div class="local-diff-selectors">
                  <label>方案 A <select class="local-diff-left" aria-label="对比方案 A"></select></label>
                  <span>vs</span>
                  <label>方案 B <select class="local-diff-right" aria-label="对比方案 B"></select></label>
                </div>
              </div>
              <div class="local-diff-output"></div>
            </section>
          </div>
        `;

        for (const chip of mountEl.querySelectorAll('.local-tag-chip')) {
          chip.addEventListener('click', () => {
            const tag = chip.dataset.tag;
            if (selectedTags.has(tag)) selectedTags.delete(tag);
            else selectedTags.add(tag);
            chip.classList.toggle('is-selected', selectedTags.has(tag));
          });
        }

        mountEl.querySelector('.local-profile-save-btn').addEventListener('click', async () => {
          if (!isLiveConfigReady()) {
            setBanner('error', '请先连接键盘并等待 68 键配置读取完成后再保存快照。');
            return;
          }
          const nameInput = mountEl.querySelector('.local-profile-name-input');
          const notesInput = mountEl.querySelector('.local-profile-notes-input');
          const name = nameInput.value.trim() || `配置快照 ${new Date().toLocaleTimeString('zh-CN', {hour12: false})}`;
          const sanitized = core.sanitizeProfileConfig(getLiveConfig());
          const res = await api.save({
            name,
            tags: [...selectedTags],
            notes: notesInput.value.trim(),
            source: 'snapshot',
            config: sanitized
          });
          if (!res?.ok) {
            setBanner('error', `保存失败：${(res?.errors || ['未知错误']).join('；')}`);
            return;
          }
          nameInput.value = '';
          notesInput.value = '';
          setBanner('success', `已保存方案「${res.profile.name}」（共 68 键，已剥离运行态字段）。`);
          await refresh();
        });

        mountEl.querySelector('.local-profile-import-btn').addEventListener('click', async () => {
          const res = await api.importFile();
          if (!res || res.canceled) return;
          if (!res.ok) {
            setBanner('error', `导入校验失败：${(res.errors || ['文件格式无效']).join('；')}`);
            return;
          }
          setBanner('success', `已导入方案「${res.profile.name}」到本地方案库。`);
          await refresh();
        });

        mountEl.querySelector('.local-diff-left').addEventListener('change', renderDiff);
        mountEl.querySelector('.local-diff-right').addEventListener('change', renderDiff);
      },
      onShow() {
        refresh();
      }
    });

    window.addEventListener('thunder68-shell-sync', () => {
      updateConnectDependentUi();
    });

    window.thunder68Profiles = Object.freeze({
      applyProfileById,
      refresh,
      listProfiles: () => summaries.slice()
    });
  }

  if (window.thunder68Shell) mountProfilesPanel();
  else window.addEventListener('thunder68-shell-ready', mountProfilesPanel, {once: true});
})();
