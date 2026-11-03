// Shared by the Admin page panels: which confirm prompt is open (one at a time), which action is running,
// its error, and the notice shown after it worked. Keys name one action on one item, e.g. 'remove:<id>'.
//   const { confirming, busy, notice, run, errorFor } = useAdminAction(() => emit('changed'))
//   run(`remove:${id}`, () => removeStall(id), () => { dropFromList(id); return 'Removed.' })
import { ref } from 'vue'

export function useAdminAction(onChanged) {
  const confirming = ref('')
  const busy = ref('')
  const error = ref({ key: '', message: '' })
  const notice = ref('')

  // Runs action(); on success calls onDone(result), which updates the list and returns the notice text.
  async function run(key, action, onDone) {
    busy.value = key
    error.value = { key: '', message: '' }
    notice.value = ''
    try {
      const result = await action()
      confirming.value = ''
      notice.value = onDone(result) || ''
      onChanged?.()
    } catch (failure) {
      error.value = { key, message: failure.message }
    } finally {
      busy.value = ''
    }
  }

  // The error message for one item's action, or ''
  const errorFor = (key) => (error.value.key === key ? error.value.message : '')

  return { confirming, busy, notice, run, errorFor }
}
