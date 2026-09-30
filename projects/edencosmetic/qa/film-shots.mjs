// The site film: a 1280×720 visit that shows the live layer (scripts/film-site.mjs). The pointer moves the sun in the first
// screen, the scroll takes the eye through the seven stages, the pointer tilts a brand card and reveals a collection.
export const init = "window.__atlForce=1;try{sessionStorage.setItem('edenSeen','1')}catch(e){};addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='.lotti,.beam{display:none!important}';document.head.appendChild(s);});";   // Lotti rests for the film
export const ready = "document.querySelector('#top')?.dataset.atl==='live'";
export default [
  { dur: 2.6, pointer: [[560, 330], [520, 360]] },                       // the products are laid down, the sun comes out
  { dur: 3.2, pointer: [[520, 360], [250, 250], [160, 470], [560, 520]] }, // the pointer moves the sun: every shadow follows
  { dur: 1.4, pointer: [[560, 520], [1000, 600]] },
  { dur: 1.6, scrollTo: '#lift', frac: 0 },
  { dur: 1.3, scrollTo: '#lift', frac: .1 },
  { dur: 1.5, scrollTo: '#lift', frac: .24 },
  { dur: 2.0, scrollTo: '#lift', frac: .4 },
  { dur: 1.6, scrollTo: '#lift', frac: .55 },
  { dur: 1.6, scrollTo: '#lift', frac: .7 },
  { dur: 2.2, scrollTo: '#lift', frac: .84 },
  { dur: 1.8, scrollTo: '#lift', frac: .97 },
  { dur: 1.6, scrollTo: '#cats', px: 60 },
  { dur: 2.2, pointer: [[1000, 600], [700, 330], [640, 360]] },
  { dur: 1.6, pointer: [[640, 360], [700, 470], [650, 600]] },
  { dur: 1.8, scrollTo: '#brands', px: 90 },
  { dur: 2.4, pointer: [[650, 600], [1010, 330], [1100, 420], [960, 470]] },
  { dur: 2.2, pointer: [[960, 470], [720, 330], [800, 460], [640, 420]] },
  { dur: 2.2, scrollTo: '#about', px: 40 },
  { dur: 1.6 }
];
