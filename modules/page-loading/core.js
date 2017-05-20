import {PAGE_LOADING_ID} from '../state/constants'
import {changeState} from '../state/events'

// showPageLoading :: String -> String -> IMPURE
export const showPageLoading = () => changeState(PAGE_LOADING_ID, {visible: true})

// hidePageLoading :: String -> String -> IMPURE
export const hidePageLoading = () => changeState(PAGE_LOADING_ID, {visible: false})

// showPageLoadingSuccess :: String -> String -> IMPURE
export const showPageLoadingSuccess = () => changeState(PAGE_LOADING_ID, {success: true})

// hidePageLoadingSuccess :: String -> String -> IMPURE
export const hidePageLoadingSuccess = () => changeState(PAGE_LOADING_ID, {success: false})
