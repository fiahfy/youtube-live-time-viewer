import {
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'
import type { Settings } from '~/models'
import type { AppState } from '~/store'

type State = Settings

export const initialState: State = {
  timeFormat: '12h',
}

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTimeFormat(state, action: PayloadAction<'12h' | '24h'>) {
      return { ...state, timeFormat: action.payload }
    },
  },
})

export const { setTimeFormat } = settingsSlice.actions

export default settingsSlice.reducer

export const selectSettings = (state: AppState) => state.settings

export const selectTimeFormat = createSelector(
  selectSettings,
  (settings) => settings.timeFormat,
)
