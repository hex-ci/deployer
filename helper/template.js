const template = (str, vars) => {
  for (const [key, value] of Object.entries(vars)) {
    str = str.replaceAll(`{{${key}}}`, value)
  }

  return str
}

export default template
