import {
  Container,
  CssBaseline,
  FormControl,
  FormControlLabel,
  FormLabel,
  GlobalStyles,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material'
import { type ChangeEvent, useId } from 'react'
import StoreProvider from '~/providers/StoreProvider'
import { useAppDispatch, useAppSelector } from '~/store'
import { selectTimeFormat, setTimeFormat } from '~/store/settings'

const App = () => {
  const timeFormat = useAppSelector(selectTimeFormat)
  const dispatch = useAppDispatch()

  const id = useId()

  const handleChangeTimeFormat = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value as '12h' | '24h'
    dispatch(setTimeFormat(value))
  }

  return (
    <Container>
      <Stack spacing={2} sx={{ my: 2, userSelect: 'none' }}>
        <FormControl component="fieldset" size="small">
          <FormLabel component="legend" id={id}>
            <Typography gutterBottom variant="subtitle2">
              Time Format
            </Typography>
          </FormLabel>
          <RadioGroup
            aria-labelledby={id}
            value={timeFormat}
            onChange={handleChangeTimeFormat}
          >
            <FormControlLabel
              value="12h"
              control={<Radio size="small" sx={{ px: 1, py: 0.5 }} />}
              label="12-hour (6:45:00 PM)"
              slotProps={{ typography: { variant: 'body2' } }}
            />
            <FormControlLabel
              value="24h"
              control={<Radio size="small" sx={{ px: 1, py: 0.5 }} />}
              label="24-hour (18:45:00)"
              slotProps={{ typography: { variant: 'body2' } }}
            />
          </RadioGroup>
        </FormControl>
      </Stack>
    </Container>
  )
}

const Popup = () => {
  return (
    <StoreProvider>
      <CssBaseline />
      <GlobalStyles
        styles={{
          html: { overflowY: 'hidden', width: 220 },
        }}
      />
      <App />
    </StoreProvider>
  )
}

export default Popup
