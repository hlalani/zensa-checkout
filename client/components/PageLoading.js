import React, {Component} from 'react'
import PropTypes from 'prop-types'
import R from 'ramda'
import {PAGE_LOADING_ID} from '../../modules/state/constants'
import {getElemState} from '../../modules/state/core'
import {changeState} from '../../modules/state/events'
import {lightGold} from '../../modules/styles/colors'

import SuccessIcon from './Icons/SuccessIcon'
import CircularLoader from './Icons/CircularLoader'

export default class PageLoading extends Component {
  static propTypes = {
    rootState: PropTypes.object.isRequired,
  }

  constructor(props) {
    super(props)
  }

  checkIsPageLoadingVisible = () => {
    const {rootState} = this.props
    return R.prop('visible', getElemState(rootState, PAGE_LOADING_ID))
  }
  checkIsPageLoadingSuccess = () => {
    const {rootState} = this.props
    return R.prop('success', getElemState(rootState, PAGE_LOADING_ID))
  }

  render() {
    const isPageLoadingVisible = this.checkIsPageLoadingVisible()
    const isPageLoadingSuccess = this.checkIsPageLoadingSuccess()
    const initialStyle = {opacity: 0, display: 'none'}
    const finalStyle = {opacity: 1, display: 'block'}
    const style = isPageLoadingVisible ? finalStyle : initialStyle
    // console.log('rendered page loading')

    return (
      <div style={style}>
        <div className="fixed top-0 right-0 bottom-0 left-0 z4" style={{backgroundColor: 'rgba(0,0,0,0.6)'}}>
          {isPageLoadingSuccess ? (
            <SuccessIcon
              className="top-0 right-0 bottom-0 left-0 z5"
              style={{position: 'fixed', margin: 'auto'}}
            />
          ) : (
            <CircularLoader
              color={lightGold}
              className="top-0 right-0 bottom-0 left-0 z5"
              style={{position: 'fixed', margin: 'auto'}}
            />
          )}
        </div>
      </div>
    )
  }
}
