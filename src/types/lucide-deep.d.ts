// Allow direct deep imports from lucide-react for bundle optimization
declare module 'lucide-react/dist/esm/icons/*' {
  import { type LucideIcon } from 'lucide-react'
  const icon: LucideIcon
  export default icon
}
