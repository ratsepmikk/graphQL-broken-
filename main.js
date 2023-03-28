// Use this tutorial for implementing lodash: https://www.youtube.com/watch?v=M7WL2Cfa2ww (In the end I used a combination of chatGPT + my brain + stackoverflow posts)
// Use this link for testing querys: https://cloud.hasura.io/public/graphiql?endpoint=https%3A%2F%2F01.kood.tech%2Fapi%2Fgraphql-engine%2Fv1%2Fgraphql
// Use this to find the logic behind level calculations: https://gist.github.com/kigiri/b570c1788c0ef32b4467aa2bcf99b217

// Commented out code is legacy and stuff for testing and possible future upgrades, ignore it :D

const userQuery = `
	query UserQuery ($name: String = "liki123") {
		user: user(where: {login: {_eq: $name}}) {
			id
			login
		}
	}`
const taskListQuery = `
	query taskListQuery($name: String = "liki123", $offset: Int = 0) {
		main: progress(
			where: {user: {login: {_eq: $name}}, isDone: {_eq: true}, object: {_or: [{type: {_eq: "piscine"}}, {type: {_eq: "project"}}]}}
			offset: $offset
			order_by: {createdAt: asc_nulls_first}
		) {
			isDone
			path
			createdAt
			object {
				name
				type
				id
			}
		}
	}`
const taskXPQuery = `
  query taskXPQuery($name: String = "liki123", $id: Int = 3345) {
		xps: transaction(
			where: {user: {login: {_eq: $name}}, object: {id: {_eq: $id}}, type: {_eq: xp}, amount: {}}
			order_by: {amount: desc_nulls_last}
			limit: 1
		) {
			object {
				id
				type
				name
			}
			amount
			type
			isBonus
		}
	}`
const bonusTaskXPQuery = `
	query bonusXPQuery($name: String = "liki123") {
		bonuses: transaction(
			where: {user: {login: {_eq: $name}}, isBonus: {_eq: true}}
			order_by: {amount: desc_nulls_last}
		) {
			object {
				id
				type
				name
			}
			amount
			type
			isBonus
			createdAt
		}
	}`
const userLevelRequest = `
query userLevelRequest($name: String = "liki123") {
  transaction(
    where: {user: {login: {_eq: $name}}, type: {_eq: "level"}, object: {type: {_nregex: "exercise|raid"}}}
    limit: 1
    offset: 0
    order_by: {amount: desc}
  ) {
    amount
  }
}`
const baseURL = "https://01.kood.tech/api/graphql-engine/v1/graphql"
const searchForm = document.getElementById("user-search-form")
const searchInput = document.getElementById("user-search")
const MAX_LEVEL = 128
const LEVELS = [...Array(MAX_LEVEL + 1).keys()].map(level => {
	const base = (level + 2) * 150 + 50
	const total = Math.round((level * 0.66 + 1) * base)
	return { level, base, total }
})
function getCumulativeTotalXP(level) {
	let cumulativeTotal = 0;
	let i = 0
	for (; i < level; i++) {
		cumulativeTotal += LEVELS[i].total;
	}
	console.log(`Last level that was added: ${i}`)
	return cumulativeTotal;
}
let DATA = {
	userID: 0,
	username: '',
	avatar: () => { return `https://01.kood.tech/git/user/avatar/${DATA.username}/-1` },
	userLevel: 0,
	totalXP: 0,
	audits_done_xp: 0, // not yet implemented
	audits_received_xp: 0, // not yet implemented
	audit_ratio: () => { return calcAuditRatio(this.audits_done_xp, this.audits_received_xp) }, // inputs are not implemented
	tasks: new Map(),
};
const calcAuditRatio = (up, down) => {
	// ratio = Up / Down
	if (up === 0) { return 0 }
	if (down === 0) { return Infinity }
	return up / down
}
// Data needed from requests for proceeding requests
let currentTaskID = undefined;
let offsetIndex = 0;
// Getters
const taskXPVariables = () => {
	return {
		name: DATA.username,
		id: currentTaskID,
	}
}
const taskListVariables = () => {
	return {
		name: DATA.username,
		offset: offsetIndex,
	}
}
const userVariables = () => { return { name: DATA.username } };

// RequestHandler
const APICalls = async () => {
	// Fetch audit XPs (up + down)
	{
		// let { data } = await queryFetch("fetch xp of audits")
		// DATA.audits_done_xp = 0;
		// DATA.audits_received_xp = 0
	}
	// Fetch user's latest level
	{
		let { data } = await queryFetch("user level query")
		DATA.userLevel = data.transaction[0].amount;
	}
	// Fetch tasks ($name) (taskname, id, isDone, updatedAt)
	{
		let result = await queryFetch("task query");
		while (0 !== result?.data?.main?.length) {
			result?.data?.main?.forEach((task) => {
				if (!task.isDone) { return }
				const tempObject = {
					taskName: task.object.name,
					isDone: task.isDone,
					createdAt: task.createdAt,
					isPiscine: task.object.type === 'piscine',
					xp: null,
				}
				DATA.tasks.set(task.object.id, tempObject)
				return
			})
			offsetIndex += 50
			result = await queryFetch("task query");
		}
	}
	// Fetch tasks' XPs ($id) (xp)
	{
		// Fetch for each task separately and collect the promises
		let promiseList = [];
		DATA.tasks.forEach((val, id) => {
			currentTaskID = id;
			promiseList.push(queryFetch("task xp query"))
		})
		// Resolving all the promises at once (huge performance improvement)
		let all_xp_data = await Promise.all(promiseList)
		// Flattening unnessecary layers
		all_xp_data = all_xp_data.map((data) => {
			return data.data.xps[0]
		})
		// Filter out values tasks that did not reward XP to the div 01 (example: GO piscine)
		all_xp_data = all_xp_data.filter((data) => {
			return !(!data)
		})
		// Matching the xp's with the right tasks.
		all_xp_data = all_xp_data.map((xpData) => {
			if (xpData.amount === null) { return xpData }
			let temp = DATA.tasks.get(xpData.object.id)
			temp.xp = xpData.amount
			DATA.tasks.set(xpData.object.id, temp)
		})
		// Calculate total XP - Must be separate to ignore tasks that were not passed by the auditors.
		DATA.tasks.forEach((task) => {
			DATA.totalXP += task.xp
		})
		/* Fetch bonus points */
		let { bonuses } = (await queryFetch("Bonus points query")).data
		bonuses.map((bonusTask) => {
			switch (bonusTask.amount) {
				case 250000:
					//	This is most likely the mentor program bonus
					DATA.tasks.set(bonusTask.object.id, { taskName: bonusTask.object.name, isDone: true, createdAt: bonusTask.createdAt, xp: bonusTask.amount })
					DATA.totalXP += bonusTask.amount;
					break;
				case 390000:
					//	These points are most likely the rust piscine's points (assigned as a bonus)
					DATA.tasks.forEach((task, key) => {
						if (key === 100978) {
							if (task.xp !== null) {
								console.error('Points already exist in data')
							}
							task.xp = bonusTask.amount
							DATA.totalXP += bonusTask.amount
						}
					})
					break;
				default:
					alert("Unknown bonus points found, contact the project's owner!"); break;
			}
		})
	}
}

// Fetches the data
async function queryFetch(queryType) {
	return await fetch(baseURL, getFetchOptions(queryType))
		.then((res) => res.json())
}

// Packs your query Body
function getFetchOptions(indentifier) {
	let Body;

	switch (indentifier) {
		case "user query":
			Body = JSON.stringify({
				query: userQuery,
				variables: userVariables(),
			}); break;
		case "user level query":
			userLevelRequest
			Body = JSON.stringify({
				query: userLevelRequest,
				variables: userVariables(),
			}); break;
		// case "fetch xp of audits":
		// 	Body = JSON.stringify({
		// 		query: auditXPQuery,
		// 		variables: auditXPVariables
		// 	}); break;
		case "task query":
			Body = JSON.stringify({
				query: taskListQuery,
				variables: taskListVariables()
			}); break;
		case "task xp query":
			Body = JSON.stringify({
				query: taskXPQuery,
				variables: taskXPVariables()
			}); break;
		case "Bonus points query":
			Body = JSON.stringify({
				query: bonusTaskXPQuery,
				variables: userVariables()
			}); break;
		default:
			console.error("Such query does not exist")
			return
	}

	return {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: Body,
	}
}
// Function for throttling
async function toBeThrottled() {
	DATA = {
		userID: 0,
		username: '',
		avatar: () => { return `https://01.kood.tech/git/user/avatar/${DATA.username}/-1` },
		userLevel: 0,
		totalXP: 0,
		audits_done_xp: 0, // not yet implemented
		audits_received_xp: 0, // not yet implemented
		audit_ratio: () => { return calcAuditRatio(this.audits_done_xp, this.audits_received_xp) }, // inputs are not implemented
		tasks: new Map(),
	}
	offsetIndex = 0;
	const targetUsername = searchInput.value
	DATA.username = targetUsername
	if (targetUsername !== "") {
		let { data } = await queryFetch("user query")
		if (data.user.length === 0) { return }
		if (data.user.length > 1) { console.error("Too many matching users found"); return }
		DATA.userID = data.user[0].id

		// Fetch other stuff after this
		await APICalls()

		// Display data as graphs
		console.table(JSON.stringify(DATA))
		makeGraphs();
	}
}

function formatXP(xP, useBinaryUnits, stepCount = 0) {
	let newStepCount
	let newXP
	let unitSize = useBinaryUnits ? 1024 : 1000;

	if (xP >= unitSize) {
		[newXP, newStepCount] = formatXP(xP / unitSize, useBinaryUnits, stepCount + 1)
		if (stepCount === 0) {
			let unit
			switch (newStepCount) {
				case 0:
					unit = 'B'; break;
				case 1:
					unit = 'kB'; break;
				case 2:
					unit = 'MB'; break;
				case 3:
					unit = 'GB'; break;
				case 4:
					unit = 'TB'; break;
				default:
					unit = '?'
			}
			return `${Math.round(newXP * 1000) / 1000}${unit}`
		}
		return [newXP, newStepCount]
	}
	return [xP, stepCount]
}

function makeLevelGraph(svg) {
	// Data calc for xp progress chart
	const MIN = getCumulativeTotalXP(DATA.userLevel)
	const MAX = getCumulativeTotalXP(DATA.userLevel + 1)
	const CURRENT = DATA.totalXP
	const PER_CENT = Math.round((CURRENT - MIN) / (MAX - MIN) * 100)
	console.log(`min: ${MIN}, max: ${MAX}, current: ${CURRENT}, per-cent: ${PER_CENT}`)
	const data = [
		{ name: "progress", value: CURRENT - MIN },
		{ name: "needed xp", value: MAX - CURRENT },
	];

	// Setting Pie	
	const pie = d3.pie()
		.value(d => d.value)
		.sort(null);

	// Configuring svg
	const width = 160;
	const height = 160;

	const unit = ""

	svg.attr("width", `${width}${unit}`)
		.attr("height", `${height}${unit}`)
		.attr("viewBox", `0 0 ${width}${unit} ${height}${unit}`);

	// Setting center point
	const g = svg.append("g")
		.attr("transform", `translate(${width / 2}${unit}, ${height / 2}${unit})`)
		.text("Center");

	// arc ( arc == pie chart slice) generator
	const radius = Math.min(width, height) / 2;
	const arc = d3.arc()
		.innerRadius(`${radius * 0.5}${unit}`)
		.outerRadius(`${radius}${unit}`)

	// Generating the pie chart
	g.selectAll("path")
		.data(pie(data))
		.enter()
		.append("path")
		.attr("d", arc)
		.attr("fill", (d, i) => i === 1 ? "gray" : "#4CAF50")

	// Adding the per-centage to the middle
	g.append('text')
		.attr('text-anchor', 'middle')
		.attr('transform', `translate(0, ${8})`)
		.attr('font-size', '2rem')
		.text(`${PER_CENT}%`);
	// Format text
	g.select('text')
		.attr('fill', '#959595')
		.attr('font-weight', 'bold');
}

function fillInformation(displayDIV) {
	console.table(LEVELS)
	/* Basics */
	displayDIV.select("#avatar")
		.attr("src", DATA.avatar()).attr("alt", `avatar image of ${DATA.username}`)

	/* Main stats */
	displayDIV.select("#username")
		.text(DATA.username)

	displayDIV.select("#user-id")
		.text(DATA.userID)

	displayDIV.select("#user-level")
		.text(DATA.userLevel)

	displayDIV.select("#total-xp")
		.text(formatXP(DATA.totalXP, false))

	displayDIV.select("#true-total-xp")
		.text(formatXP(DATA.totalXP, true))

	// /* Audit */
	// displayDIV.select("#audit-ratio")
	// 	.text(DATA.audit_ratio());

	// /* Audit scores */
	// // Audit score (up)
	// displayDIV.select("#audit-up")
	// 	.text(`↑: ${DATA.audits_done_xp}`)
	// // Audit score (down)
	// displayDIV.select("#audit-down")
	// 	.text(`↓: ${DATA.audits_received_xp}`)
	d3.select("#level-graph-container>*").remove();
	makeLevelGraph(d3.select("#level-graph-container").insert("svg"))
}

function makeGraphs() {
	let displayDIV = d3.select('#display')
	fillInformation(displayDIV)

	d3.select("#graph-1>*").remove()
	/* The 2nd bigger graph was removed as only 2 graphs are needed to pass the audit 
	and I prefer a more simplistic design*/
	// d3.select("#graph-2>*").remove() 

	const margin = { top: 50, right: 50, bottom: 50, left: 80 };
	const width = 1700 - margin.left - margin.right;
	const height = 420 - margin.top - margin.bottom;

	const svg = d3.select("#graph-1")
		.append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	const tooltip = d3.select("#graph-1")
		.append("div")
		.attr("class", "tooltip")
		.style("opacity", 0);

	const data = new Array()

	{
		const parser = d3.timeParse('%Y-%m-%dT%H:%M:%S')
		DATA.tasks.forEach((task) => {
			if (task.xp === null) {
				console.log(task)
				return
			}
			data.push({ taskName: task.taskName, date: parser(task.createdAt.split(".")[0]), xp: task.xp, cumulativeSumOfPrev: 0 })
		})

		let tempTotal = 0
		data.forEach((task) => {
			const copiedValue = task.xp
			task.xp = tempTotal + copiedValue
			task.cumulativeSumOfPrev = tempTotal
			tempTotal += copiedValue
		})
	}

	console.table(data)

	const xScale = d3.scaleTime()
		.domain(d3.extent(data, function (d) { return d.date; }))
		.range([0, width]);

	const yScale = d3.scaleLinear()
		.domain([0, d3.max(data, function (d) { return d.xp; })])
		.range([height, 0]);

	const line = d3.line()
		.x(function (d) { return xScale(d.date); })
		.y(function (d) { return yScale(d.xp); });
	console.count("No error: ");

	svg.append("path")
		.datum(data)
		.attr("class", "line")
		.attr("d", line)
		.attr("fill", "none")
		.attr("stroke", "#429945");

	svg.selectAll(".point")
		.data(data)
		.enter().append("circle")
		.attr("class", "point")
		.attr("r", 4) // increase the radius to make the hover area bigger
		.attr("cx", function (d) { return xScale(d.date); })
		.attr("cy", function (d) { return yScale(d.xp); })
		.on("mouseover", function (d) {
			const [x, y] = d3.mouse(d3.select("html").node());
			console.log(`x: ${x}y: ${y}`)
			tooltip.transition()
				.duration(200)
				.style("display", "block")
				.style("opacity", .9)
				.style("position", "absolute")
				.style("left", `${x}px`)
				.style("top", `${y - 80}px`)
				.style("background-color", "rgba(0, 0, 0, 0.7)")
				.style("color", "white")
				.style("border-radius", `${10}px`)
				.style("padding", `${4}px`)
			tooltip.html(`Task: ${d.taskName}<br/>XP: ${d.xp - d.cumulativeSumOfPrev}<br/>Sum: ${d.xp}`)
		})
		.on("mouseout", function (d) {
			tooltip
				.style("opacity", 0)
				.style("display", "none");
		});

	svg.append("g")
		.attr("transform", `translate(0,${height})`)
		.call(d3.axisBottom(xScale));

	svg.append("g")
		.call(d3.axisLeft(yScale));
}

let timeoutId;
const throttle = (func, delay) => {
	return function () {
		const context = this;
		const args = arguments;
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			func.apply(context, args);
		}, delay);
	};
};

const main = () => {
	searchForm.addEventListener('submit', (event) => {
		event.preventDefault();
		throttle(() => {
			toBeThrottled()
			searchInput.focus();
		}, 3000)();
	});
};
main()
toBeThrottled()
searchInput.focus();

// Older graph designs (bar chart design's)

// const graphWidth = d3.select("#graph-1").style("width").split("p")[0];
	// const graphHeight = d3.select("#graph-1").style("height").split("p")[0];
	// const barMargin = 5;

	// // Graph 1
	// {
	// 	let data = [80, 120, 60, 150, 250, 500, 370, 165];

	// 	const dataMin = Math.min(...data) - 50;
	// 	const dataMax = Math.max(...data);
	// 	const dataLength = data.length;
	// 	const barWidth = graphWidth / dataLength;

	// 	console.log(graphHeight);

	// 	d3.select("#graph-1>*").remove()

	// 	let g = displayDIV.select("#graph-1")
	// 		.append('svg').attr("width", `${graphWidth}`).attr("height", `${graphHeight}`).attr('class', 'graph')
	// 		.selectAll('g')
	// 		.data(data)
	// 		.enter()
	// 		.append('g')
	// 		.attr('transform', function (d, i) {
	// 			return `translate(${i * barWidth},0)`;
	// 		})

	// 	g.append('rect')
	// 		.attr("width", `${barWidth - barMargin}`)
	// 		.attr("height", function (data) {
	// 			return `${graphHeight * (data - dataMin) / (dataMax - dataMin)}`
	// 		})
	// 		.attr("y", function (data) {
	// 			const barHeight = graphHeight * (data - dataMin) / (dataMax - dataMin);
	// 			return `${graphHeight - barHeight}`
	// 		});
	// }

	// // // Graph 2 v.2
	// // {
	// // 	let svg = displayDIV.append('svg').attr("width", 600).attr("height", 500),
	// // 			margin = 200,
	// // 			width = svg.attr("width") - margin,
	// // 			height = svg.attr("height") - margin;

	// // 	let xScale = d3.scaleBand().range([0, width]).padding(0.4),
	// // 			yScale = d3.scaleLinear().range([height, 0]);

	// // 	let g = svg.append("g").attr("transform", `translate(${100},${100})`);

	// // 	d3.csv
	// // }

	// // Graph 2
	// {
	// 	let data = [80, 120, 60, 150, 250, 500, 370, 165];

	// 	const dataMin = Math.min(...data) - 50;
	// 	const dataMax = Math.max(...data);
	// 	const dataLength = data.length;
	// 	const barWidth = graphWidth / dataLength;

	// 	console.log(graphHeight);

	// 	d3.select("#graph-2>*").remove()

	// 	let g = displayDIV.select("#graph-2")
	// 		.append('svg').attr("width", `${graphWidth}`).attr("height", `${graphHeight}`).attr('class', 'graph')
	// 		.selectAll('g')
	// 		.data(data)
	// 		.enter()
	// 		.append('g')
	// 		.attr('transform', function (d, i) {
	// 			return `translate(${i * barWidth},0)`;
	// 		})

	// 	g.append('rect')
	// 		.attr("width", `${barWidth - barMargin}`)
	// 		.attr("height", function (data) {
	// 			return `${graphHeight * (data - dataMin) / (dataMax - dataMin)}`
	// 		})
	// 		.attr("y", function (data) {
	// 			const barHeight = graphHeight * (data - dataMin) / (dataMax - dataMin);
	// 			return `${graphHeight - barHeight}`
	// 		});
	// }