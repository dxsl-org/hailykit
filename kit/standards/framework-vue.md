# Vue.js Standards (Vue 3 + Composition API)

## Component Structure — `<script setup>` (preferred)

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { User } from '@/types'

// Props + emits declared at top
const props = defineProps<{ userId: string }>()
const emit = defineEmits<{ updated: [user: User] }>()

// Reactive state
const user = ref<User | null>(null)
const isLoading = ref(false)

// Derived state
const displayName = computed(() => user.value?.name ?? 'Unknown')

// Side effects
onMounted(async () => {
  isLoading.value = true
  user.value = await fetchUser(props.userId)
  isLoading.value = false
})
</script>
```

## Reactivity Rules

- `ref()` for primitives and object roots; access with `.value` in `<script>`, not in `<template>`
- `reactive()` for objects when you don't need to reassign the root — no `.value` needed
- `computed()` for derived values — cached, only re-runs when deps change
- `shallowRef()` / `shallowReactive()` for large objects where only root changes matter

```ts
// Avoid: reactive() on primitives
const count = reactive(0)  // ❌ — use ref(0)

// Avoid: destructuring reactive() loses reactivity
const { name } = reactive(user)  // ❌ — use toRefs() or keep as user.name
const { name } = toRefs(user)    // ✅
```

## Composables (Vue equivalent of hooks)

Extract reusable stateful logic into `use*` functions:

```ts
// composables/useUser.ts
export function useUser(userId: Ref<string>) {
  const user = ref<User | null>(null)
  const error = ref<Error | null>(null)

  watchEffect(async () => {
    user.value = await fetchUser(userId.value).catch(e => { error.value = e; return null })
  })

  return { user: readonly(user), error: readonly(error) }
}
```

## Watch vs WatchEffect

```ts
// watch — explicit deps, runs when they change, access old value
watch(userId, async (newId, oldId) => {
  user.value = await fetchUser(newId)
}, { immediate: true })

// watchEffect — auto-tracks deps used inside, no old value
watchEffect(async () => {
  user.value = await fetchUser(userId.value)  // userId tracked automatically
})
```

## Template Directives

```vue
<ul>
  <li v-for="item in items" :key="item.id">{{ item.name }}</li>  <!-- always :key -->
</ul>

<div v-if="isAdmin">Admin panel</div>
<div v-else-if="isMod">Mod panel</div>
<div v-else>User panel</div>

<input v-model="searchQuery" />        <!-- two-way binding -->
<button @click="handleClick">Save</button>
<img :src="imageUrl" />               <!-- : = v-bind shorthand -->
```

## Best Practices

- Prefer `<script setup>` over Options API for all new components
- Always set `:key` on `v-for` — use stable IDs, not array index
- Use `defineProps` with TypeScript generics — no runtime overhead
- `readonly()` on composable return values to prevent external mutation
- Pinia for global state (not Vuex)
- Vue Router 4: `useRouter()` / `useRoute()` composables in `<script setup>`
