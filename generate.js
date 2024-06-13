#!/usr/bin/env node

// Generate a new electron-based player app for a given uuid

const { readFileSync, existsSync, cpSync, writeSync, writeFileSync, mkdirSync } = require("fs")
const {JSDOM} = require("jsdom")
const path = require("path")

const helpString = `Usage: \`${process.argv[0]} ${process.argv[1]} <project-uuid> <result-path>\`
	It will create a directory at \`result-path\``


// Attempt to use these to download character svgs
const knownGoodProjectURLS = [/*"https://c.gethopscotch.com/p/zi4k2lqt6",*/ "https://c.gethopscotch.com/p/-1", "https://c.gethopscotch.com/p/138o34zhv8", "https://c.gethopscotch.com/p/12o83o6bsw", "https://c.gethopscotch.com/p/12ds9b7p3y", "https://c.gethopscotch.com/p/xii9vn8sh", "https://c.gethopscotch.com/p/12juixsl0n", "https://c.gethopscotch.com/p/11bycfpp0j", "https://c.gethopscotch.com/p/13pyjx5u37"]

if (process.argv.length < 4) {
	console.error("Bad arguments.")
	console.error(helpString)
	process.exit(1)
}
const destinationPath = process.argv[3]
if (existsSync(destinationPath)) {
	console.error("Destination path already exists!")
	process.exit(7)
}
let allowedDomains = ["gethopscotch"]
if (process.argv.length >= 5) {
	allowedDomains = readFileSync(process.argv[4]).toJSON()
	console.log("!!!!! Allowing domains from json file!!!!!")
}

async function main() {
	console.log("Downloading project")
	const project = await getProjectJsonFromUserInputUUID(process.argv[2])
	const title = project.title || "Untitled"
	const author = project.user?.nickname || project.author || "Unknown Author"
	const playerVersion = project.playerVersion || "1.0.0"
	// TODO: Consider filtering escape sequences before logging
	console.log(`Found ${title} by ${author} using player ${playerVersion}`)
	console.log("Downloading player information")
	// TODO: Allow user to provide their own (possibly modded) player files
	//       and provide easy way to specify you want the AE mod verison
	const webplayersIndexResponse = await (await fetch("https://s3.amazonaws.com/hopscotch-webplayer/production/EDITOR_INDEX")).json()
	const webplayers = webplayersIndexResponse.editor_table.webplayers
	const splitVerson = playerVersion.split(".")
	let version;
	do {
		version = webplayers[splitVerson.join(".")]
		splitVerson[2]++
	} while (webplayers[splitVerson.join(".")])
	if (!version) {
		console.error("Could not find webplayer")
		process.exit(3)
	}
	const playerScriptURL = `https://s3.amazonaws.com/hopscotch-webplayer/production/${version.path}`
	const pixiScriptURL = `https://s3.amazonaws.com/hopscotch-webplayer/production/pixi/${version.pixi}/pixi.min.js`
	console.log("Downloading webplayer")
	// Replace sound url
	const playerScript = (await (await fetch(playerScriptURL)).text()).replaceAll("https://d2jeqdlsh5ay24.cloudfront.net", "sounds/")
	console.log("Downloading pixi")
	const pixiScript = await (await fetch(pixiScriptURL)).text()
	console.log("Downloading character SVGs")
	const svgString = await (async () => {
		for (let i = 0; i < knownGoodProjectURLS.length; i++) {
			const url = knownGoodProjectURLS[i]
			const html = await (await fetch(url)).text()
			const doc = new JSDOM(html);
			const svgString = doc.window.document.querySelector(".svg")?.outerHTML
			if (svgString) {
				return svgString
			}
			console.log(`Project #${i} failed, trying the next one`)
		}
		console.error("Could not download svg string! None of the projects tried worked")
		process.exit(5)
	})()
	console.log("Copying template")
	cpSync(path.join(__dirname, "template"), destinationPath, {recursive: true})
	console.log("Adding project file")
	writeFileSync(path.join(destinationPath, "project.hopscotch"), JSON.stringify(project))
	console.log("Adding player file")
	writeFileSync(path.join(destinationPath, "player.js"), playerScript)
	console.log("Adding pixi file")
	writeFileSync(path.join(destinationPath, "pixi.js"), pixiScript)
	console.log("Modifying index.html")
	// TODO: Figure out why using JSDOM didn't work for this
	function htmlEscape(str) {
		return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;').replaceAll("$", "&#036");
	}
	const titleTag = `<title>${htmlEscape(title)} by ${htmlEscape(author)}</title>`
	const playerTag = `<hopscotch-player data-project-json='${htmlEscape(JSON.stringify(project))}' stage-size='container' id='player'></hopscotch-player>`
	let html = readFileSync(path.join(destinationPath, "index.html")).toString()
	html = html.replaceAll("__PETRICHOR__TITLE__TAG__", titleTag).replaceAll("__PETRICHOR__SVG_STRING__TAG__", svgString).replaceAll("__PETRICHOR__PLAYER__TAG__", playerTag)
	writeFileSync(path.join(destinationPath, "index.html"), html)
	
	console.log("Copying custom images")
	const filenames = project.remote_asset_urls
	for (let i = 0; i < filenames.length; i ++) {
		const filename = filenames[i]
		if (/[\/]/.test(filename)) {
			console.error(`Skipping ${filename} for having a sus filename`)
			return
		}
		const url = `https://hopscotch-images.s3.amazonaws.com/production/images/project-images/${filename}`
		const image = new Uint8Array(await (await fetch(url)).arrayBuffer())
		writeFileSync(path.join(destinationPath, "custom_images", filename), image)
	}
	console.log("Downloading sounds")
	const sounds = getAllUsedSoundPaths(project)
	for (let i = 0; i < sounds.length; i ++) {
		const soundName = sounds[i]
		let soundPath = soundName.split(".");
		let name = soundPath[0];
		let extension = soundPath[1] || "mp3";
		const filename = `${name}.${extension}`
		const finalPath = path.join(destinationPath, "sounds", filename)
		if (!existsSync(path.dirname(finalPath)))
			mkdirSync(path.dirname(finalPath), {recursive: true})

		const url = `https://d2jeqdlsh5ay24.cloudfront.net/${filename}`
		const sound = new Uint8Array(await (await fetch(url)).arrayBuffer())
		writeFileSync(finalPath, sound)
	}
	console.log("Done!")
}
main()




async function getProjectJsonFromUserInputUUID(uuid) {
	// Never pass anything other than an already extracted uuid here
	// In case that gets ignored, handle the most likely other formats too.
	const jsonURL = (() => {
		if (/^https?:\/\//.test(uuid)) {
			if (/^https?:\/\/(c(ommunity)|explore)?\.([^\.]+)\.com\/p(rojects)?\/([^\/])/.test(uuid)) {
				// Simple project link or explore link
				const match = /^https?:\/\/(c(ommunity)|explore)?\.([^\.]+)\.com\/p(rojects)?\/([^\/])/.match(uuid)
				const domain = match[2]
				const actualUUID = match[4]
				if (!allowedDomains.includes(domain)) {
					console.error("!!!!!!!!! Bad domain!")
					console.error(domain)
					process.exit(2)
				}
				return `https://community.${domain}.com/api/v1/projects/${actualUUID}`
			} else {
				// Unknown url format, just assume the final part of the path is the uuid, maybe with a `.hopscotch` suffix
				//    Conveniently, `.` is disallowed in project uuids
				const splitURL = uuid.split("/")
				const assumedUUID = splitURL[splitURL.length - 1].split(".")[0]
				return `https://community.gethopscotch.com/api/v1/projects/${assumedUUID}`
			}
		} else if (/file:\/\//.test(uuid)) {
			// File url
			return uuid
		}
		// Assume the user was good and passed the uuid in an expected format
		return `https://community.gethopscotch.com/api/v1/projects/${uuid}`
	})()
	return await (await fetch(jsonURL)).json()
}

function getAllUsedSoundPaths(project) {
	const HSParameterType = {
		Sound: 51,
		MusicNote: 60,
		Instrument: 61
	}
	const DEFAULT_INSTRUMENT = "piano"
	const VALID_INSTRUMENTS = ["ocarina", "piano", "vibraphone", "guitar", "cello", "8bit", "choir"];

	let soundNames = []
	const alreadyDownloadedInstruments = []
	const forEachParameter = param => {
		// Will be called with every parameter in the project
		switch (param.type) {
			case HSParameterType.Sound:
				if (soundNames.indexOf(param.value) === -1) {
					soundNames.push(param.value);
				}
				break;
			case HSParameterType.MusicNote:
				soundNames = soundNames.concat(allMusicNotesFor(DEFAULT_INSTRUMENT));
				break;
			case HSParameterType.Instrument:
				soundNames = soundNames.concat(allMusicNotesFor(param.value));
			default:
				break;
		}
	}

	function allMusicNotesFor(instrument) {
		instrument = parseInstrumentName(instrument);
        if (alreadyDownloadedInstruments.includes(instrument) || !VALID_INSTRUMENTS.includes(instrument)) {
            return [];
        }
        alreadyDownloadedInstruments.push(instrument);
        return [...Array(37).keys()].map(n => {
            return instrument + "/" + (n + 48) + ".wav";
        });
	}

	function parseInstrumentName(instrument) {
		if (instrument === "strings") {
			instrument = "cello";
		}
	
		return instrument.toLocaleLowerCase().replace(" ", "");
	}
	const enumerateParameters = parameter => {
		forEachParameter(parameter)
		if (parameter.datum?.params?.length > 0) {
			parameter.datum.params.forEach(enumerateParameters)
		}
	}
	project.abilities.forEach(ability => {
		ability.blocks.forEach(block => {
			if (!block.parameters)
				return
			block.parameters.forEach(enumerateParameters)
		})
	})
	project.rules.forEach(rule => {
		rule.parameters.forEach(enumerateParameters)
	})
	project.customRuleInstances.forEach(rule => {
		rule.parameters.forEach(enumerateParameters)
	})
	return soundNames
}