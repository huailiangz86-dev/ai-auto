<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useAuthStore } from './stores/auth'

onLaunch(() => {
  useAuthStore().restoreSession()
})
</script>

<style lang="scss">
@import './styles/index.scss';
</style>
