import React, { useState, useRef, useEffect } from 'react';
import { HiOutlineFilter, HiChevronDown } from 'react-icons/hi';
import { MdFilterAlt } from 'react-icons/md';
import { HiCheck, HiOutlineRefresh } from 'react-icons/hi';
import './FilterBar.css';

/* ─────────────────────────────────────────
   Filter field config
   (Tumhari custom widths ke sath)
───────────────────────────────────────── */
const FILTER_CONFIGS = [
  { label: 'BU',              name: 'bu',              width: '120px' },
  { label: 'Customer',        name: 'customer',        width: '250px' },
  { label: 'LOA ID',          name: 'loa_id',          width: '130px' },
  { label: 'LOA Name',        name: 'loa_name',        width: '300px' },
  { label: 'WBS Type',        name: 'wbs_type',        width: '140px' },
  { label: 'WBS',             name: 'wbs',             width: '300px' }, // Matches columnMapping['wbs']
  { label: 'WBS Description', name: 'wbs_description', width: '300px' },
  { label: 'Period',          name: 'period',          width: '110px' },
  { label: 'Active/Inactive', name: 'active_inactive', width: '150px' },
  { label: 'Category Type',   name: 'category_type',   width: '170px' }
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
═══════════════════════════════════════════════ */
const MultiSelect = ({ name, label, options, selected: selectedProp, onChange }) => {

  const selected = Array.isArray(selectedProp)
    ? selectedProp
    : selectedProp && selectedProp !== 'All'
      ? [selectedProp]
      : [];

  const [isOpen, setIsOpen]       = useState(false);
  const [search, setSearch]       = useState('');
  const containerRef              = useRef(null);
  const searchRef                 = useRef(null);

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

  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
    }
  };

  const toggleOption = (val) => {
    if (selected.includes(val)) {
      onChange(name, selected.filter((v) => v !== val));
    } else {
      onChange(name, [...selected, val]);
    }
  };

  const filteredOptions = options.filter((opt) =>
    opt.toString().toLowerCase().includes(search.toLowerCase())
  );

  const hasSelection = selected.length > 0;
  const visiblePills  = selected.slice(0, 2);
  const overflowCount = selected.length - 2;

  return (
    <div ref={containerRef} className={`ms-container ${hasSelection ? 'ms-container--active' : ''}`} onKeyDown={handleKeyDown}>
      <label className="ms-label" id={`label-${name}`}>
        {label}
        {hasSelection && (
          <span className="ms-count-badge">{selected.length}</span>
        )}
      </label>

      <div
        role="button"
        tabIndex={0}
        className={`ms-trigger ${isOpen ? 'ms-trigger--open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen((prev) => !prev); }}}
      >
        <span className="ms-trigger-left">
          {hasSelection ? (
            <span className="ms-pills-row">
              {visiblePills.map((val) => (
                <span key={val} className="ms-pill">
                  {val}
                  <button
                    type="button"
                    className="ms-pill-x"
                    onClick={(e) => {
                      e.stopPropagation(); 
                      toggleOption(val);
                    }}
                  >×</button>
                </span>
              ))}
              {overflowCount > 0 && <span className="ms-pill-more">+{overflowCount}</span>}
            </span>
          ) : (
            <span className="ms-placeholder">All</span>
          )}
        </span>
        <HiChevronDown className={`ms-arrow ${isOpen ? 'ms-arrow--up' : ''}`} aria-hidden="true" />
      </div>

      {isOpen && (
        <div className="ms-dropdown" role="listbox">
          <div className="ms-search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="ms-search"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

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
                  >
                    <span className={`ms-checkbox ${isSelected ? 'ms-checkbox--checked' : ''}`}>
                      {isSelected && <HiCheck className="ms-check-icon" />}
                    </span>
                    {/* 🔥 Yahan lambe text ka wrapping hoga */}
                    <span className="ms-option-text">{opt}</span> 
                  </li>
                );
              })
            )}
          </ul>

          {hasSelection && (
            <div className="ms-footer">
              <span className="ms-footer-count">{selected.length} selected</span>
              <button type="button" className="ms-footer-clear" onClick={() => onChange(name, [])}>
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
   ACTIVE FILTERS BAR
═══════════════════════════════════════════════ */
const ActiveFiltersBar = ({ filters, filterConfigs, onRemove, onClearAll }) => {
  const activeEntries = filterConfigs.filter(
    (cfg) => Array.isArray(filters[cfg.name]) && filters[cfg.name].length > 0
  );

  // Agar koi active filter nahi hai, toh yeh bar aur Reset button hide ho jayega
  if (activeEntries.length === 0) return null;

  return (
    <div className="afb-bar">
      <span className="afb-label">
        <MdFilterAlt className="afb-label-icon" />
        Active Filters:
      </span>

      {activeEntries.map((cfg) => {
        const vals        = filters[cfg.name];
        const displayVals = vals.slice(0, 2).join(', ');
        const extra       = vals.length > 2 ? ` +${vals.length - 2}` : '';

        return (
          <span key={cfg.name} className="afb-chip">
            <span className="afb-chip-key">{cfg.label}</span>
            <span className="afb-chip-val" title={vals.join(', ')}>
              {displayVals}{extra}
            </span>
            <button type="button" className="afb-chip-x" onClick={() => onRemove(cfg.name)}>×</button>
          </span>
        );
      })}

      {/* 🔥 BUTTON RENAMED to "Reset Filters" AND STYLED BETTER */}
      <button type="button" className="afb-clear-all" onClick={onClearAll}>
        <HiOutlineRefresh className="afb-clear-icon" />
        Reset Filters
      </button>
    </div>
  );
};

/* ═══════════════════════════════════════════════
   MAIN FILTERBAR
═══════════════════════════════════════════════ */
const FilterBar = ({ filters, options, onFilterChange, onReset }) => {

  const getOptions = (name) => {
    if (name === 'period') return sortPeriods(options.period);
    return options[name] || [];
  };

  const handleRemoveFilter = (name) => onFilterChange(name, []);

  return (
    <div className="fb-wrapper">
      <div className="fb-grid">
        {FILTER_CONFIGS.map((cfg) => (
          <div
            key={cfg.name}
            className="fb-cell"
            // 🔥 NAYA STYLE: flex: "1 1 {width}" aur minWidth: 0 zaroori hai squish karne ke liye
            style={{ flex: `1 1 ${cfg.width}`, minWidth: 0 }}
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
      </div>

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