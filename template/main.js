const { app, BrowserWindow, ipcMain } = require('electron')
const { readFileSync } = require('fs')
const os = require('os')
const path = require("path")

const createWindow = (size) => {
  const {width, height} = size
  const win = new BrowserWindow({
    width,
    height,
	webPreferences: {
		preload: path.join(__dirname, 'preload.js')
	  }
  })

  win.loadFile('index.html')
  return win
}

app.whenReady().then(() => {
	const size = getProjectSize()
	const username = os.userInfo().username
	ipcMain.handle('osUsername', () => username)
	const win = createWindow(size)
	win.setAspectRatio(size.width / size.height)
})

function getProjectSize() {
	const project = JSON.parse(readFileSync(path.join(__dirname, "project.hopscotch")).toString())
	return project.stageSize
}