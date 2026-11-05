/**
 * Código do botão de favoritos "➕ Achadinhos".
 * Roda no navegador do Marcos, na página da loja que ele está vendo (Amazon, Mercado Livre ou Shopee),
 * lê nome / preço / preço antigo / foto / cupom e abre o formulário do painel já preenchido.
 * Nenhum robô acessa as lojas.
 */
export function bookmarkletCode(appUrl: string) {
  const app = JSON.stringify(appUrl.replace(/\/$/, ""));
  const js = `(function(){
var APP=${app};
var $=function(s,r){return (r||document).querySelector(s);};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
var txt=function(e){return e?(e.textContent||'').replace(/\\s+/g,' ').trim():'';};
var num=function(t){if(!t)return 0;var c=String(t).replace(/[^0-9,.]/g,'');if(!c)return 0;var n=c.indexOf(',')>=0?Number(c.replace(/\\./g,'').replace(',','.')):Number(c);return isFinite(n)?n:0;};
var meta=function(p){var e=$('meta[property="'+p+'"],meta[name="'+p+'"]');return e?e.getAttribute('content'):'';};
var h=location.hostname,d={link:'',title:'',price:0,old:0,img:'',site:'',coupon:''};
var findCoupon=function(){var best='';$$('span,div,label,p,button,a,li').forEach(function(e){if(e.children.length>4)return;var r=e.getBoundingClientRect();if(!r.width||!r.height)return;var t=txt(e);if(t.length<4||t.length>70)return;if(!/cupo(m|ns)|voucher/i.test(t))return;if(!/(\\d{1,2}\\s?%|R\\$\\s?\\d)/.test(t))return;if(!best||t.length<best.length)best=t;});return best;};

if(/amazon\\.com\\.br$/.test(h)){
  var m=location.pathname.match(/\\/(?:dp|gp\\/product|gp\\/aw\\/d)\\/([A-Z0-9]{10})/i);
  if(!m){alert('Abra a página de um produto da Amazon e clique de novo.');return;}
  d.site='amazon';d.link='https://www.amazon.com.br/dp/'+m[1];
  d.title=txt($('#productTitle'));
  var box=$('#corePriceDisplay_desktop_feature_div')||$('#corePrice_feature_div')||$('#corePrice_desktop')||$('#apex_desktop')||$('#apex_offerDisplay_desktop')||document;
  var pr=function(el){if(!el)return 0;var o=txt($('.a-offscreen',el));if(num(o))return num(o);var w=txt($('.a-price-whole',el)).replace(/[^0-9]/g,''),f=txt($('.a-price-fraction',el)).replace(/[^0-9]/g,'');return w?Number(w+'.'+(f||'00')):0;};
  d.price=pr($('.priceToPay',box))||pr($('.apexPriceToPay',box))||pr($('.a-price:not(.a-text-price)',box))||pr($('#priceblock_dealprice'))||pr($('#priceblock_ourprice'));
  var olds=[$('.basisPrice .a-price',box),$('.a-price.a-text-price[data-a-strike="true"]',box),$('.a-price.a-text-price',box),$('[data-a-strike="true"]'),$('#listPrice'),$('#priceblock_listprice')];
  for(var i=0;i<olds.length;i++){var v=olds[i]?(pr(olds[i])||num(txt(olds[i]))):0;if(v>d.price&&v<d.price*5){d.old=v;break;}}
  if(!d.old){$$('span,div',box).some(function(e){var t=txt(e);if(e.children.length<6&&/^(De|Pre\\u00e7o (anterior|original|de tabela))\\s*:/i.test(t)){var v=num(t.replace(/^[^R]*/,''));if(v>d.price&&v<d.price*5){d.old=v;return true;}}return false;});}
  var im=$('#landingImage')||$('#imgBlkFront')||$('#main-image');
  d.img=im?(im.getAttribute('data-old-hires')||im.getAttribute('src')||''):meta('og:image');
}else if(/mercadolivre\\.com\\.br$/.test(h)){
  d.site='ml';
  d.title=txt($('h1.ui-pdp-title'))||meta('og:title').replace(/\\s*\\|\\s*Mercado Livre.*$/i,'');
  var ar=function(re){var v=0;$$('[aria-label]').some(function(e){var a=e.getAttribute('aria-label')||'';var mm=a.match(re);if(mm){v=Number(mm[1].replace(/\\./g,''))+(mm[2]?Number(mm[2])/100:0);return true;}return false;});return v;};
  d.price=ar(/^Agora:\\s*([\\d.]+)\\s*reais(?:\\s*com\\s*(\\d+)\\s*centavos)?/i)||num(($('meta[itemprop="price"]')||{getAttribute:function(){return '';}}).getAttribute('content'));
  if(!d.price){var f=$('.ui-pdp-price__second-line .andes-money-amount__fraction');var c=$('.ui-pdp-price__second-line .andes-money-amount__cents');d.price=f?Number(txt(f).replace(/\\./g,'')+'.'+(c?txt(c):'00')):0;}
  d.old=ar(/^Antes:\\s*([\\d.]+)\\s*reais(?:\\s*com\\s*(\\d+)\\s*centavos)?/i);
  if(!d.old){var p=$('.andes-money-amount--previous');if(p){var pf=$('.andes-money-amount__fraction',p),pc=$('.andes-money-amount__cents',p);d.old=pf?Number(txt(pf).replace(/\\./g,'')+'.'+(pc?txt(pc):'00')):0;}}
  if(!(d.old>d.price))d.old=0;
  var gi=$('.ui-pdp-gallery__figure img')||$('figure img');
  d.img=(gi&&(gi.getAttribute('data-zoom')||gi.getAttribute('src')))||meta('og:image');
}else if(/shopee\\.com\\.br$/.test(h)){
  var si=location.pathname.match(/-i\\.(\\d+)\\.(\\d+)/)||location.pathname.match(/\\/product\\/(\\d+)\\/(\\d+)/);
  if(!si){alert('Abra a p\\u00e1gina de um produto da Shopee e clique de novo.');return;}
  d.site='shopee';d.link='https://shopee.com.br/product/'+si[1]+'/'+si[2];
  d.title=meta('og:title').replace(/\\s*\\|\\s*Shopee.*$/i,'');
  d.img=meta('og:image');
}else{alert('O bot\\u00e3o funciona em p\\u00e1ginas de produto da Amazon, Mercado Livre e Shopee.');return;}
d.coupon=findCoupon();

var fmt=function(n){return n?n.toFixed(2).replace('.',','):'';};
var q=function(k,v){return '&'+k+'='+encodeURIComponent(String(v||'').trim());};
var send=function(){var u=APP+'/nova-oferta?via=favorito'+q('site',d.site)+q('link',d.link)+q('title',d.title.slice(0,150))+q('price',fmt(d.price))+q('originalPrice',fmt(d.old))+q('imageUrl',d.img)+q('coupon',d.coupon);var w=window.open(u,'_blank');if(!w)location.href=u;};
if(d.site!=='ml'){send();return;}
var roots=function(){var out=[document],i=0;while(i<out.length){var r=out[i++];var all=r.querySelectorAll?r.querySelectorAll('*'):[];for(var k=0;k<all.length;k++){var e=all[k];if(e.shadowRoot)out.push(e.shadowRoot);if(e.tagName==='IFRAME'){try{if(e.contentDocument)out.push(e.contentDocument);}catch(x){}}}}return out;};
var deep=function(sel){var res=[];roots().forEach(function(r){Array.prototype.push.apply(res,Array.prototype.slice.call(r.querySelectorAll(sel)));});return res;};
var RE=/https:\\/\\/meli\\.la\\/[A-Za-z0-9]+/;
var findMeli=function(){var v='';deep('input,textarea').some(function(e){var m=String(e.value||'').match(RE);if(m){v=m[0];return true;}return false;});if(!v){deep('a[href*="meli.la"],span,p,div').some(function(e){if(e.children&&e.children.length>3)return false;var m=String(e.getAttribute&&e.getAttribute('href')||e.textContent||'').match(RE);if(m){v=m[0];return true;}return false;});}return v;};
d.link=findMeli();
if(d.link){send();return;}
var btn=null;deep('button,a,[role="button"]').some(function(e){if(/^\\s*Compartilhar\\s*$/i.test(e.textContent||'')&&e.getBoundingClientRect().top<200){btn=e;return true;}return false;});
if(btn)btn.click();
var tries=0,iv=setInterval(function(){tries++;d.link=findMeli();if(d.link||tries>30){clearInterval(iv);var esc=deep('[aria-label="Fechar"],.andes-modal__close-button')[0];if(d.link&&esc)try{esc.click();}catch(e){}send();}},200);
})();`;
  return "javascript:" + encodeURIComponent(js.replace(/\n/g, ""));
}
