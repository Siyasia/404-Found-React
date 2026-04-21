// BARREL FILE — this is the only file components should import from.
// When swapping to backend this file does not need change .

export * from './goals.js'
export * from './actionPlans.js'
export * from './habits.js'
export * from './streaks.js'
export * from './calendar.js'
export * from './tasks.js'

import * as goals from './goals.js'
import * as actionPlans from './actionPlans.js'
import * as habits from './habits.js'
import * as streaks from './streaks.js'
import * as calendar from './calendar.js'
import * as tasks from './tasks.js'

export default {
  ...goals,
  ...actionPlans,
  ...habits,
  ...streaks,
  ...calendar,
  ...tasks,
}
