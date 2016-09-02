const types = [
  {
    name: 'buffer',
    test: (val) => Buffer.isBuffer(val),
    encode: (val) => val,
    decode: (val) => val,
  },
  // default to jsonish
  {
    name: 'jsonish',
    test: () => true,
    encode: (val) => JSON.stringify(val),
    decode: (val) => JSON.parse(val),
  },
]
const typesByName = {}
types.forEach(type => { typesByName[type.name] = type })

export const getTypeByName = (name) => typesByName[name]
export const getType = (value) => types.find(({ test }) => test(value))

