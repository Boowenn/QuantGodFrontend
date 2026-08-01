<template>
  <div class="qg-metric-grid">
    <article
      v-for="item in normalizedItems"
      :key="item.label"
      class="qg-metric-card"
      :data-status="item.status || 'neutral'"
    >
      <span class="qg-metric-card__label">{{ item.label }}</span>
      <strong>{{ formatDisplayValue(item.value) }}</strong>
      <small v-if="item.hint">{{ formatDisplayValue(item.hint) }}</small>
    </article>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { formatDisplayValue } from '../../utils/displayText.js';

const props = defineProps({
  items: { type: Array, default: () => [] },
});

const normalizedItems = computed(() => props.items.filter((item) => item && item.label));
</script>
