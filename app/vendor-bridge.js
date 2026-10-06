/* A narrow adapter to the captured React/Redux runtime. Never alters its bundle. */
(() => {
  let store;
  const discover = () => {
    if (store) return store;
    const root = document.getElementById('root');
    const key = root && Object.keys(root).find(k => k.startsWith('__reactContainer$'));
    const fiber = key && root[key];
    const queue = [fiber?.stateNode?.current || fiber];
    let visited = 0;
    while (queue.length && visited++ < 10000) {
      const current = queue.pop(); if (!current) continue;
      const props = current.memoizedProps;
      const candidate = props?.store || props?.value?.store;
      if (candidate?.getState && candidate?.subscribe && candidate?.dispatch) {store = candidate; return store;}
      queue.push(current.child, current.sibling);
    }
  };
  const state = () => {
    const common = discover()?.getState()?.persistent?.common;
    if (!common) return null;
    return {common, config: common[common.currentConfigName]};
  };
  window.thunder68Presentation = Object.freeze({
    state,
    selectKeys(ids) {
      const value = state();
      const allowed = new Set(value?.common.deviceParams?.layoutMappingData?.map(k => k.id));
      if (!Array.isArray(ids) || ids.some(id => !allowed.has(id))) return false;
      discover().dispatch({type: 'USER_CLICK_MAP_PENDING_KEY', payload: ids});
      return true;
    },
    subscribe(callback) {return discover()?.subscribe(callback);}
  });
})();
