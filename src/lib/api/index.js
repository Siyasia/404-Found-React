// BARREL FILE — this is the only file components should import from.
// When swapping to backend this file does not need change .
// Will add streaks.js and calendar.js exports here when those modules are created.

export * from './goals.js'
export * from './actionPlans.js'

import * as goals from './goals.js'
import * as actionPlans from './actionPlans.js'

export default {
  ...goals,
  ...actionPlans,
}
