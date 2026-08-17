<template>
  <div class="toast" :class="{ show: !!user.toastMsg }">{{ user.toastMsg }}</div>
</template>

<script setup>
import { useUserStore } from '@/store/user'
const user = useUserStore()
</script>
