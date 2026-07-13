import React, { useState, useRef, useEffect } from 'react';
import { HiOutlineRefresh, HiOutlineFilter, HiChevronDown } from 'react-icons/hi';
import { MdFilterAlt } from 'react-icons/md';
import { HiCheck } from 'react-icons/hi';
import './FilterBar.css';

/* ─────────────────────────────────────────
   Filter field config
   colSpan = how many columns in 12-col grid
───────────────────────────────────────── */
const FILTER_CONFIGS = [
  { label: 'BU',              name: 'bu',              colSpan: 1 },
  { label: 'Customer',        name: 'customer',        colSpan: 2 },
  { label: 'LOA ID',          name: 'loa_id',          colSpan: 1 },
  { label: 'LOA Name',        name: 'loa_name',        colSpan: 2 },
  { label: 'WBS Type',        name: 'wbs_type',        colSpan: 1 },
  { label: 'WBS',             name: 'wbs',             colSpan: 2 },
  { label: 'WBS Description', name: 'wbs_description', colSpan: 2 },
  { label: 'Active/Inactive', name: 'active_inactive', colSpan: 1 },
  { label: 'Period',          name: 'period',          colSpan: 1 },
];

/* ─────────────────────────────────────────
   Period sort helper - descending
───────────────────────────────────────── */
const sortPeriods = (periods = []) =>
  [...periods]
    .filter((p) => p && p !== '0-P' && /^\d{4}-P\d+$/.test(p))
    .sort((a, b) => {
      const [ya, pa] = a.split('-P').map(Number);
      const [yb, pb] = b.split('-P').map(Number);
      return yb !== ya ? yb - ya : pb - pa;
    });

/* ═══════════════════════════════════════════════
   CUSTOM MULTI-SELECT DROPDOWN COMPONENT
   Replaces Select2 completely
═══════════════════════════════════════════════ */
const MultiSelect = ({ name, label, options, selected: selectedProp, onChange }) => {

  /*
   * SAFETY NET: Parent mein purana string-based filters state ho sakta hai.
   * Normalize karo - string/null/undefined sab ko array mein convert karo.
   * 'Active' → ['Active'],  'All' → [],  undefined → [],  [] → []
   */
  const selected = Array.isArray(selectedProp)
    ? selectedProp
    : selectedProp && selectedProp !== 'All'
      ? [selectedProp]
      : [];

  const [isOpen, setIsOpen]       = useState(false);
  const [search, setSearch]       = useState('');
  const containerRef              = useRef(null);
  const searchRef                 = useRef(null);

  /* Close on outside click */
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  /* Focus search box when dropdown opens */
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  /* Close on Escape key */
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
    }
  };

  /* Toggle a single option */
  const toggleOption = (val) => {
    if (selected.includes(val)) {
      onChange(name, selected.filter((v) => v !== val));
    } else {
      onChange(name, [...selected, val]);
    }
  };

  /* Filter options by search text */
  const filteredOptions = options.filter((opt) =>
    opt.toString().toLowerCase().includes(search.toLowerCase())
  );

  const hasSelection = selected.length > 0;

  /* Pills to show inside the box - max 2 visible, rest as +N */
  const visiblePills  = selected.slice(0, 2);
  const overflowCount = selected.length - 2;

  return (
    <div
      ref={containerRef}
      className={`ms-container ${hasSelection ? 'ms-container--active' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {/* ── Label ── */}
      <label className="ms-label" id={`label-${name}`}>
        {label}
        {hasSelection && (
          <span className="ms-count-badge">{selected.length}</span>
        )}
      </label>

      {/* ── Trigger Box ── */}
      {/* div instead of button - because pill ✕ buttons are inside, nested buttons invalid HTML */}
      <div
        role="button"
        tabIndex={0}
        className={`ms-trigger ${isOpen ? 'ms-trigger--open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen((prev) => !prev); }}}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`label-${name}`}
        aria-label={`${label}: ${hasSelection ? selected.join(', ') : 'All'}`}
      >
        {/* Left side: pills or placeholder */}
        <span className="ms-trigger-left">
          {hasSelection ? (
            <span className="ms-pills-row">
              {visiblePills.map((val) => (
                <span key={val} className="ms-pill">
                  {val}
                  {/* ✕ remove pill */}
                  <button
                    type="button"
                    className="ms-pill-x"
                    onClick={(e) => {
                      e.stopPropagation(); // don't open/close dropdown
                      toggleOption(val);
                    }}
                    aria-label={`Remove ${val}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {overflowCount > 0 && (
                <span className="ms-pill-more">+{overflowCount}</span>
              )}
            </span>
          ) : (
            <span className="ms-placeholder">All</span>
          )}
        </span>

        {/* Right: chevron arrow */}
        <HiChevronDown
          className={`ms-arrow ${isOpen ? 'ms-arrow--up' : ''}`}
          aria-hidden="true"
        />
      </div>

      {/* ── Dropdown panel ── */}
      {isOpen && (
        <div className="ms-dropdown" role="listbox" aria-multiselectable="true" aria-label={label}>

          {/* Search input */}
          <div className="ms-search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="ms-search"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={`Search ${label} options`}
            />
          </div>

          {/* Options list */}
          <ul className="ms-options-list">
            {filteredOptions.length === 0 ? (
              <li className="ms-no-results">No results found</li>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <li
                    key={opt}
                    role="option"
                    aria-selected={isSelected}
                    className={`ms-option ${isSelected ? 'ms-option--selected' : ''}`}
                    onClick={() => toggleOption(opt)}
                    onKeyDown={(e) => e.key === 'Enter' && toggleOption(opt)}
                    tabIndex={0}
                  >
                    {/* Checkbox indicator */}
                    <span className={`ms-checkbox ${isSelected ? 'ms-checkbox--checked' : ''}`} aria-hidden="true">
                      {isSelected && <HiCheck className="ms-check-icon" />}
                    </span>
                    <span className="ms-option-text">{opt}</span>
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer: count + clear this filter */}
          {hasSelection && (
            <div className="ms-footer">
              <span className="ms-footer-count">{selected.length} selected</span>
              <button
                type="button"
                className="ms-footer-clear"
                onClick={() => onChange(name, [])}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════
   ACTIVE FILTERS BAR - chips summary below grid
═══════════════════════════════════════════════ */
const ActiveFiltersBar = ({ filters, filterConfigs, onRemove, onClearAll }) => {
  const activeEntries = filterConfigs.filter(
    (cfg) => Array.isArray(filters[cfg.name]) && filters[cfg.name].length > 0
  );

  if (activeEntries.length === 0) return null;

  return (
    <div className="afb-bar" role="region" aria-label="Active filters summary">
      <span className="afb-label">
        <MdFilterAlt className="afb-label-icon" aria-hidden="true" />
        Active Filters:
      </span>

      {activeEntries.map((cfg) => {
        const vals        = filters[cfg.name];
        const displayVals = vals.slice(0, 2).join(', ');
        const extra       = vals.length > 2 ? ` +${vals.length - 2}` : '';

        return (
          <span
            key={cfg.name}
            className="afb-chip"
            role="group"
            aria-label={`${cfg.label}: ${vals.join(', ')}`}
          >
            <span className="afb-chip-key">{cfg.label}</span>
            <span className="afb-chip-val" title={vals.join(', ')}>
              {displayVals}{extra}
            </span>
            <button
              type="button"
              className="afb-chip-x"
              onClick={() => onRemove(cfg.name)}
              aria-label={`Remove ${cfg.label} filter`}
            >
              ×
            </button>
          </span>
        );
      })}

      <button
        type="button"
        className="afb-clear-all"
        onClick={onClearAll}
        aria-label="Clear all filters"
      >
        Clear All
      </button>
    </div>
  );
};

/* ═══════════════════════════════════════════════
   MAIN FILTERBAR
═══════════════════════════════════════════════ */
const FilterBar = ({ filters, options, onFilterChange, onReset }) => {

  /* Build options list per field */
  const getOptions = (name) => {
    if (name === 'period') return sortPeriods(options.period);
    return options[name] || [];
  };

  /* Remove single filter from Active Bar */
  const handleRemoveFilter = (name) => {
    onFilterChange(name, []);
  };

  return (
    <div className="fb-wrapper" role="search" aria-label="Filter options">

      {/* Header row */}
      <div className="fb-header">
        <HiOutlineFilter className="fb-header-icon" aria-hidden="true" />
        <span className="fb-header-title">Filters</span>
      </div>

      {/* Grid of dropdowns */}
      <div className="fb-grid">
        {FILTER_CONFIGS.map((cfg) => (
          <div
            key={cfg.name}
            className="fb-cell"
            style={{ '--col-span': cfg.colSpan }}
          >
            <MultiSelect
              name={cfg.name}
              label={cfg.label}
              options={getOptions(cfg.name)}
              selected={filters[cfg.name] || []}
              onChange={onFilterChange}
            />
          </div>
        ))}

        {/* Reset button cell */}
        <div className="fb-reset-cell">
          <button
            type="button"
            onClick={onReset}
            className="fb-reset-btn"
            aria-label="Reset all filters"
          >
            <HiOutlineRefresh className="fb-reset-icon" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      {/* Active filters summary bar */}
      <ActiveFiltersBar
        filters={filters}
        filterConfigs={FILTER_CONFIGS}
        onRemove={handleRemoveFilter}
        onClearAll={onReset}
      />
    </div>
  );
};

export default FilterBar;