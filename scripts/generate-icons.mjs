import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const svg = await readFile(new URL('../build/icon.svg', import.meta.url))
const sizes = [16, 32, 64, 128, 256, 512, 1024]
const pngs = new Map()
for (const size of sizes) {
  pngs.set(size, await sharp(svg).resize(size, size).png().toBuffer())
}
await writeFile(new URL('../build/icon.png', import.meta.url), pngs.get(512))

// Modern ICO files may embed PNG payloads. Include the common Windows sizes.
const icoSizes = [16, 32, 64, 256]
const icoHeader = Buffer.alloc(6 + icoSizes.length * 16)
icoHeader.writeUInt16LE(0, 0)
icoHeader.writeUInt16LE(1, 2)
icoHeader.writeUInt16LE(icoSizes.length, 4)
let icoOffset = icoHeader.length
const icoPayloads = []
icoSizes.forEach((size, index) => {
  const payload = pngs.get(size)
  const offset = 6 + index * 16
  icoHeader.writeUInt8(size === 256 ? 0 : size, offset)
  icoHeader.writeUInt8(size === 256 ? 0 : size, offset + 1)
  icoHeader.writeUInt8(0, offset + 2)
  icoHeader.writeUInt8(0, offset + 3)
  icoHeader.writeUInt16LE(1, offset + 4)
  icoHeader.writeUInt16LE(32, offset + 6)
  icoHeader.writeUInt32LE(payload.length, offset + 8)
  icoHeader.writeUInt32LE(icoOffset, offset + 12)
  icoOffset += payload.length
  icoPayloads.push(payload)
})
await writeFile(new URL('../build/icon.ico', import.meta.url), Buffer.concat([icoHeader, ...icoPayloads]))

// ICNS supports PNG payloads in modern icon elements.
const icnsTypes = new Map([[16, 'icp4'], [32, 'icp5'], [64, 'icp6'], [128, 'ic07'], [256, 'ic08'], [512, 'ic09'], [1024, 'ic10']])
const icnsElements = sizes.map((size) => {
  const payload = pngs.get(size)
  const element = Buffer.alloc(8 + payload.length)
  element.write(icnsTypes.get(size), 0, 4, 'ascii')
  element.writeUInt32BE(element.length, 4)
  payload.copy(element, 8)
  return element
})
const icnsLength = 8 + icnsElements.reduce((sum, element) => sum + element.length, 0)
const icnsHeader = Buffer.alloc(8)
icnsHeader.write('icns', 0, 4, 'ascii')
icnsHeader.writeUInt32BE(icnsLength, 4)
await writeFile(new URL('../build/icon.icns', import.meta.url), Buffer.concat([icnsHeader, ...icnsElements]))
