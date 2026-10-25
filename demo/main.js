// Demo only: mounts the package the same way the host page does.
import { mount } from '../package/seo-forecast.js';

const el = document.getElementById('forecast');
if (el) mount(el, { lang: document.documentElement.lang === 'en' ? 'en' : 'de' });
