import React from 'react'
import PropTypes from 'prop-types'
import R from 'ramda'

/*
  Usage example
  <CircularLoader />
*/

const CircularLoader = ({color = '', style = {}, className = ''}) => {
  const baseStyle = {}
  const finalStyle = R.merge(baseStyle, style)

  return (
    <div className={`loader ${className}`} style={finalStyle}>
      <svg className="circular-loader" viewBox="25 25 50 50" >
        <circle className="loader-path" cx="50" cy="50" r="20" fill="none" stroke={color} strokeWidth="3" />
      </svg>
    </div>
  )
}

export default CircularLoader

CircularLoader.propTypes = {
  className: PropTypes.string,
  style: PropTypes.object,
}
