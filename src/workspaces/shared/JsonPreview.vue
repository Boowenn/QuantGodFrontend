<template>
  <section class="qg-json-preview">
    <header>
      <h3>{{ title }}</h3>
      <span v-if="source" class="qg-json-preview__source">{{ sourceLabel }}</span>
    </header>
    <pre>{{ formatted }}</pre>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { redactSensitiveEvidence } from '../../utils/redactSensitiveEvidence.js';

const props = defineProps({
  title: { type: String, required: true },
  payload: { type: [Object, Array, String, Number, Boolean], default: null },
  source: { type: String, default: '' },
  maxChars: { type: Number, default: 12000 },
});

const sourceLabel = computed(() => {
  if (!props.source) return '';
  return String(props.source).startsWith('/api/') ? '本地只读证据' : props.source;
});

const formatted = computed(() => {
  let text;
  const payload = redactSensitiveEvidence(props.payload);
  if (payload === null || payload === undefined) {
    text = 'No data';
  } else if (typeof payload === 'string') {
    text = payload;
  } else {
    text = JSON.stringify(payload, null, 2);
  }

  const maxChars = Number(props.maxChars);
  if (Number.isFinite(maxChars) && maxChars > 0 && text.length > maxChars) {
    return `${text.slice(0, maxChars)}\n\n... 已截断 ${text.length - maxChars} 个字符，避免浏览器为原始证据占用过多内存。`;
  }
  return text;
});
</script>
