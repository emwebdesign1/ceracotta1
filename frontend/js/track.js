(() => {
  const ENDPOINT = '/api/track';

  function post(ev) {
    const b = JSON.stringify(ev);
    if (navigator.sendBeacon) {
      const blob = new Blob([b], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
    } else {
      fetch(ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body: b });
    }
  }
  function pageView() {
    const params = new URLSearchParams(location.search);
    const utm = { source: params.get('utm_source'), medium: params.get('utm_medium'), campaign: params.get('utm_campaign') };
    post({ type:'PAGE_VIEW', path: location.pathname, utm });
  }

  window.CeraAnalytics = {
    productView: (productId) => post({ type:'PRODUCT_VIEW', productId, path:location.pathname }),
    addToCart:   (productId) => post({ type:'ADD_TO_CART', productId, path:location.pathname }),
    beginCheckout: () => post({ type:'BEGIN_CHECKOUT', path:location.pathname }),
    purchase: (amountCents, currency='CHF') => post({ type:'PURCHASE', value: amountCents, currency, path:location.pathname })
  };

  pageView();
})();
