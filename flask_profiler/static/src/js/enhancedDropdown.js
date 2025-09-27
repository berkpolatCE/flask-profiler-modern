import { createElement } from './dom.js';

// Accessible enhanced dropdown helper
const DEFAULT_CLASS_PREFIX = 'enhanced-dropdown';

function buildClassNames(prefix = DEFAULT_CLASS_PREFIX) {
  return {
    wrapper: prefix,
    native: `${prefix}__native`,
    trigger: `${prefix}__trigger`,
    label: `${prefix}__label`,
    chevron: `${prefix}__chevron`,
    menu: `${prefix}__menu`,
    option: `${prefix}__option`,
    open: 'is-open'
  };
}

function ensureLabelId(select) {
  const associatedLabel = document.querySelector(`label[for="${select.id}"]`);
  if (associatedLabel) {
    if (!associatedLabel.id) {
      associatedLabel.id = `${select.id}-label`;
    }
    return associatedLabel.id;
  }

  return null;
}

export function enhanceDropdown(select, config = {}) {
  if (!select) {
    return null;
  }

  if (select.dataset.dropdownEnhanced === 'true' && select._enhancedDropdownController) {
    return select._enhancedDropdownController;
  }

  const {
    classPrefix = DEFAULT_CLASS_PREFIX,
    container = select.parentElement
  } = config;

  if (!container) {
    return null;
  }

  const classes = buildClassNames(classPrefix);

  select.dataset.dropdownEnhanced = 'true';

  const wrapper = createElement('div', { className: classes.wrapper });
  container.insertBefore(wrapper, select);
  wrapper.appendChild(select);

  select.classList.add(classes.native);
  select.setAttribute('aria-hidden', 'true');

  const labelId = ensureLabelId(select);

  const trigger = createElement('button', {
    className: classes.trigger,
    attrs: {
      type: 'button',
      id: `${select.id}-toggle`,
      'aria-haspopup': 'listbox',
      'aria-expanded': 'false'
    }
  });

  if (labelId) {
    trigger.setAttribute('aria-labelledby', `${labelId} ${trigger.id}`);
  } else if (select.getAttribute('aria-label')) {
    trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
  }

  const labelEl = createElement('span', { className: classes.label });
  trigger.appendChild(labelEl);

  const chevronEl = createElement('span', {
    className: classes.chevron,
    attrs: { 'aria-hidden': 'true' }
  });
  trigger.appendChild(chevronEl);

  wrapper.appendChild(trigger);

  const menu = createElement('ul', {
    className: classes.menu,
    attrs: {
      id: `${select.id}-menu`,
      role: 'listbox',
      tabindex: '-1'
    }
  });
  trigger.setAttribute('aria-controls', menu.id);
  wrapper.appendChild(menu);

  const optionNodes = Array.from(select.options).map((option) => {
    const optionItem = createElement('li', {
      className: classes.option,
      attrs: {
        'data-value': option.value,
        role: 'option',
        tabindex: '-1'
      },
      text: option.textContent
    });
    menu.appendChild(optionItem);
    return optionItem;
  });

  const setSelected = (value = select.value ?? '') => {
    let target = optionNodes.find((node) => (node.dataset.value ?? '') === value);
    if (!target) {
      target = optionNodes[0];
    }

    optionNodes.forEach((node) => node.removeAttribute('aria-selected'));

    if (target) {
      target.setAttribute('aria-selected', 'true');
      labelEl.textContent = target.textContent;
    } else {
      labelEl.textContent = '';
    }

    return target;
  };

  const closeMenu = () => {
    wrapper.classList.remove(classes.open);
    trigger.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    wrapper.classList.add(classes.open);
    trigger.setAttribute('aria-expanded', 'true');
    const active = menu.querySelector(`.${classes.option}[aria-selected="true"]`) ?? optionNodes[0];
    active?.focus();
  };

  const toggleMenu = () => {
    if (wrapper.classList.contains(classes.open)) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  const handleTriggerClick = (event) => {
    event.preventDefault();
    toggleMenu();
  };

  const focusOptionByOffset = (current, offset) => {
    if (!current) {
      return;
    }

    const currentIndex = optionNodes.indexOf(current);
    if (currentIndex === -1) {
      return;
    }

    const nextIndex = (currentIndex + offset + optionNodes.length) % optionNodes.length;
    optionNodes[nextIndex]?.focus();
  };

  const handleTriggerKeydown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!wrapper.classList.contains(classes.open)) {
        openMenu();
        return;
      }

      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const activeEl = document.activeElement;
      const current = (activeEl && activeEl.classList && activeEl.classList.contains(classes.option))
        ? activeEl
        : menu.querySelector(`.${classes.option}[aria-selected="true"]`);
      focusOptionByOffset(current, direction);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleMenu();
    } else if (event.key === 'Escape') {
      closeMenu();
      trigger.focus();
    }
  };

  const handleOptionKeydown = (optionItem, event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOptionByOffset(optionItem, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusOptionByOffset(optionItem, -1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      optionItem.click();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      trigger.focus();
    }
  };

  const handleOptionSelection = (optionItem, event) => {
    event.preventDefault();
    const value = optionItem.dataset.value ?? '';
    select.value = value;
    setSelected(value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    closeMenu();
    trigger.focus();
  };

  trigger.addEventListener('click', handleTriggerClick);
  trigger.addEventListener('keydown', handleTriggerKeydown);

  const optionClickHandlers = new Map();
  const optionKeyHandlers = new Map();

  optionNodes.forEach((optionItem) => {
    const clickHandler = (event) => handleOptionSelection(optionItem, event);
    const keyHandler = (event) => handleOptionKeydown(optionItem, event);
    optionClickHandlers.set(optionItem, clickHandler);
    optionKeyHandlers.set(optionItem, keyHandler);
    optionItem.addEventListener('click', clickHandler);
    optionItem.addEventListener('keydown', keyHandler);
  });

  const handleSelectChange = () => {
    setSelected(select.value ?? '');
  };

  select.addEventListener('change', handleSelectChange);

  const onDocumentClick = (event) => {
    if (!wrapper.contains(event.target)) {
      closeMenu();
    }
  };

  document.addEventListener('click', onDocumentClick);

  const destroy = () => {
    document.removeEventListener('click', onDocumentClick);
    trigger.removeEventListener('click', handleTriggerClick);
    trigger.removeEventListener('keydown', handleTriggerKeydown);
    optionNodes.forEach((optionItem) => {
      const clickHandler = optionClickHandlers.get(optionItem);
      const keyHandler = optionKeyHandlers.get(optionItem);
      if (clickHandler) optionItem.removeEventListener('click', clickHandler);
      if (keyHandler) optionItem.removeEventListener('keydown', keyHandler);
    });
    select.removeEventListener('change', handleSelectChange);

    // Restore select placement and clean up attributes
    const parentNode = wrapper.parentElement ?? container;
    parentNode.insertBefore(select, wrapper);
    wrapper.remove();
    select.classList.remove(classes.native);
    select.removeAttribute('aria-hidden');
    delete select.dataset.dropdownEnhanced;
    delete select._enhancedDropdownController;
  };

  const controller = {
    element: select,
    wrapper,
    trigger,
    menu,
    open: openMenu,
    close: closeMenu,
    toggle: toggleMenu,
    sync: (value) => setSelected(value ?? ''),
    destroy
  };

  select._enhancedDropdownController = controller;

  setSelected();

  return controller;
}
