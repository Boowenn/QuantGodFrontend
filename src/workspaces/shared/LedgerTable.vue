<template>
  <section class="qg-ledger-table">
    <header>
      <h3>{{ title }}</h3>
      <span>{{ rows.length }} 条</span>
    </header>
    <div v-if="!rows.length" class="qg-empty">暂无记录</div>
    <div v-else class="qg-ledger-table__scroll">
      <table>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column" scope="col">{{ humanizeLabel(column) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in visibleRows" :key="index">
            <td v-for="column in columns" :key="column" :class="cellClass(column, row[column])">
              {{ stringifyCell(column, row[column]) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { formatDisplayValue, humanizeLabel } from '../../utils/displayText.js';

const props = defineProps({
  title: { type: String, required: true },
  rows: { type: Array, default: () => [] },
  limit: { type: Number, default: 30 },
});

const columns = computed(() => {
  const first = props.rows.find((row) => row && typeof row === 'object');
  return first ? Object.keys(first).slice(0, 10) : [];
});

const visibleRows = computed(() => props.rows.slice(0, props.limit));

function parseNumeric(value) {
  if (typeof value === 'number') return value;
  const normalized = String(value ?? '').replace(/[^0-9.+-]/g, '');
  if (!normalized || !/[0-9]/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPnlColumn(column) {
  const text = String(column || '');
  if (/盈亏比|PF|profit\s*factor/i.test(text)) return false;
  return /盈亏|浮盈|profit|pnl/i.test(text);
}

function stringifyCell(column, value) {
  if (isPnlColumn(column)) {
    const numeric = parseNumeric(value);
    if (numeric !== null) {
      const sign = numeric > 0 ? '+' : '';
      return `${sign}${numeric.toFixed(2)}`;
    }
  }
  return formatDisplayValue(value);
}

function cellClass(column, value) {
  if (!isPnlColumn(column)) return '';
  const numeric = parseNumeric(value);
  if (numeric === null || numeric === 0) return 'qg-ledger-table__num qg-ledger-table__num--neutral';
  return numeric > 0
    ? 'qg-ledger-table__num qg-ledger-table__num--positive'
    : 'qg-ledger-table__num qg-ledger-table__num--negative';
}
</script>
