/**
 * Construtor de formulários a partir de uma definição de campos.
 *
 * Campo: { name, label, type, required, options, placeholder, hint, pattern,
 *          patternMessage, maxlength, min, max, step, full, rows, action }
 *   type: text | email | number | date | time | select | textarea
 *   options: [{ value, label }]  (para select)
 *   action: { label, icon, disabled, title } → botão ao lado do input (ex.: "Ler tag")
 *
 * A validação aqui é SOMENTE de formato/obrigatoriedade (experiência do usuário).
 * Regras de negócio (duplicidade, vínculos...) ficam no back-end, que devolve
 * erros por campo no formato { error: { fields: { campo: "mensagem" } } }.
 */
import { h } from './dom.js';
import { icon } from './icons.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function buildForm(fields, values = {}) {
  const controls = new Map();
  const errorEls = new Map();

  const grid = h('div', { class: 'form-grid' });

  fields.forEach((f) => {
    const id = `f-${f.name}`;
    const errId = `${id}-err`;
    let control;

    if (f.type === 'select') {
      const hasInitial = (values[f.name] ?? f.defaultValue ?? '') !== '';
      control = h('select', { class: 'select', id, name: f.name },
        !f.required || !hasInitial ? h('option', { value: '' }, f.placeholder ?? 'Selecione...') : null,
        (f.options ?? []).map((o) => h('option', { value: String(o.value) }, o.label)));
    } else if (f.type === 'textarea') {
      control = h('textarea', { class: 'textarea', id, name: f.name, rows: f.rows ?? 3, maxlength: f.maxlength, placeholder: f.placeholder });
    } else {
      control = h('input', {
        class: 'input', id, name: f.name, type: f.type ?? 'text', placeholder: f.placeholder,
        maxlength: f.maxlength, min: f.min, max: f.max, step: f.step, autocomplete: 'off',
        spellcheck: f.type === 'email' || f.name === 'tagUid' ? 'false' : null,
      });
    }

    const initial = values[f.name] ?? f.defaultValue ?? '';
    control.value = String(initial);
    if (f.disabled) control.disabled = true;
    controls.set(f.name, { control, def: f });
    control.addEventListener('input', () => clearError(f.name));

    const err = h('div', { class: 'field__error', id: errId, hidden: true });
    errorEls.set(f.name, err);
    control.setAttribute('aria-describedby', f.hint ? `${errId} ${id}-hint` : errId);

    const inputNode = f.action
      ? h('div', { class: 'input-group' }, control,
          h('button', { type: 'button', class: 'btn btn--secondary', disabled: f.action.disabled, title: f.action.title, onclick: f.action.onClick },
            f.action.icon ? icon(f.action.icon, { size: 18 }) : null, f.action.label))
      : control;

    grid.append(h('div', { class: `field ${f.full ? 'field--full' : ''}` },
      h('label', { class: 'field__label', for: id }, f.label, f.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, '*') : null),
      inputNode,
      f.hint ? h('div', { class: 'field__hint', id: `${id}-hint` }, f.hint) : null,
      err));
  });

  const form = h('form', { novalidate: true }, grid);

  function setError(name, message) {
    const entry = controls.get(name);
    const el = errorEls.get(name);
    if (!entry || !el) return;
    el.textContent = message;
    el.hidden = false;
    entry.control.setAttribute('aria-invalid', 'true');
  }
  function clearError(name) {
    errorEls.get(name).hidden = true;
    controls.get(name).control.removeAttribute('aria-invalid');
  }

  function getValues() {
    const out = {};
    controls.forEach(({ control, def }, name) => {
      const raw = control.value.trim();
      if (def.type === 'select') {
        const opt = (def.options ?? []).find((o) => String(o.value) === raw);
        out[name] = raw === '' ? null : (opt ? opt.value : raw);
      } else if (def.type === 'number') {
        out[name] = raw === '' ? null : Number(raw);
      } else {
        out[name] = raw === '' ? (def.required ? '' : null) : raw;
      }
    });
    return out;
  }

  function validate() {
    let first = null;
    const data = getValues();
    controls.forEach(({ control, def }, name) => {
      clearError(name);
      const v = control.value.trim();
      let msg = '';
      if (def.required && v === '') msg = `Preencha o campo ${def.label.toLowerCase()}.`;
      else if (v !== '') {
        if (def.type === 'email' && !EMAIL_RE.test(v)) msg = 'Informe um e-mail válido.';
        else if (def.pattern && !new RegExp(def.pattern).test(v)) msg = def.patternMessage ?? 'Formato inválido.';
        else if (def.type === 'number' && def.min != null && Number(v) < def.min) msg = `O valor mínimo é ${def.min}.`;
      }
      if (msg) {
        setError(name, msg);
        first ??= control;
      }
    });
    first?.focus();
    return first ? null : data;
  }

  /** Aplica erros devolvidos pelo back-end: { campo: "mensagem" } */
  function setErrors(fieldErrors = {}) {
    let first = null;
    Object.entries(fieldErrors).forEach(([name, msg]) => {
      setError(name, msg);
      first ??= controls.get(name)?.control;
    });
    first?.focus();
  }

  return { el: form, getValues, validate, setErrors, controls };
}
