import React from 'react'
import PropTypes from 'prop-types'
import R from 'ramda'

/*
  Usage example
  <SuccessIcon />
*/

const SuccessIcon = ({style = {}, className = ''}) => {
  const baseStyle = {}
  const finalStyle = R.merge(baseStyle, style)

  return (
    <svg className={`icon-success-animated ${className}`} style={finalStyle} viewBox="0 0 52 52">
      <circle className="icon-success-animated-circle" cx="26" cy="26" r="25" fill="none"/>
      <path className="icon-success-animated-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
    </svg>
  )
}

export default SuccessIcon

SuccessIcon.propTypes = {
  className: PropTypes.string,
  style: PropTypes.object,
}
