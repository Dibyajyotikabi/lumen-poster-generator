import { h } from './dom.js';
import { button } from './controls.js';

/** Shared inspector header: title + centre / duplicate / delete. */
export function layerHeader(title, id, { actions }) {
  return h(
    'header',
    { class: 'inspector-head' },
    h('h2', {}, title),
    h(
      'div',
      { class: 'inspector-tools' },
      button({ iconName: 'alignH', title: 'Centre horizontally', variant: 'btn-icon', onClick: () => actions.center(id, 'x') }),
      button({ iconName: 'alignV', title: 'Centre vertically', variant: 'btn-icon', onClick: () => actions.center(id, 'y') }),
      button({ iconName: 'copy', title: 'Duplicate (⌘D)', variant: 'btn-icon', onClick: () => actions.duplicate(id) }),
      button({ iconName: 'trash', title: 'Delete (⌫)', variant: 'btn-icon btn-danger', onClick: () => actions.remove(id) }),
    ),
  );
}
