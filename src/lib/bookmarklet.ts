/**
 * Código do botão de favoritos "➕ Achadinhos".
 * Roda no navegador do Marcos, na página da Amazon que ele está vendo, lê nome/preço/foto
 * e abre o formulário do painel já preenchido. Nenhum robô acessa a Amazon.
 */
export function bookmarkletCode(appUrl: string) {
  const app = JSON.stringify(appUrl.replace(/\/$/, ""));
  const js = `(function(){
var APP=${app};
var m=location.pathname.match(/\\/(?:dp|gp\\/product|gp\\/aw\\/d)\\/([A-Z0-9]{10})/i);
if(!/amazon\\.com\\.br$/.test(location.hostname)||!m){alert('Abra a página de um produto da Amazon.com.br e clique de novo.');return;}
var core=document.querySelector('#corePriceDisplay_desktop_feature_div,#corePrice_feature_div,#corePrice_desktop,#apex_desktop')||document;
var p=core.querySelector('.priceToPay .a-offscreen,.a-price:not(.a-text-price) .a-offscreen');
var o=core.querySelector('.a-price.a-text-price .a-offscreen,.basisPrice .a-offscreen');
var img=document.querySelector('#landingImage,#imgBlkFront,#main-image');
var src=img?(img.getAttribute('data-old-hires')||img.getAttribute('src')||''):'';
var t=document.querySelector('#productTitle');
var q=function(k,v){return '&'+k+'='+encodeURIComponent((v||'').trim());};
window.open(APP+'/nova-oferta?via=favorito'+q('link','https://www.amazon.com.br/dp/'+m[1])+q('title',t?t.textContent.slice(0,150):'')+q('price',p?p.textContent:'')+q('originalPrice',o?o.textContent:'')+q('imageUrl',src),'_blank');
})();`;
  return "javascript:" + encodeURIComponent(js.replace(/\n/g, ""));
}
