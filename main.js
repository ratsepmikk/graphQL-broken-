// curl "https://01.kood.tech/api/graphql-engine/v1/graphql" --data '{"query":"{user(where:{id:{_eq:6}}){id login}}"} Karin Künnapas 
const baserURL = "https://01.kood.tech/api/graphql-engine/v1/graphql"

const searchForm = document.getElementById("user-search-form")
const searchInput = document.getElementById("user-search")

const DATA = {}

searchForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const targetUsername = searchInput.value
	if (targetUsername !== "") {
		Search(targetUsername)
		Display()
		searchInput.value = ""
	}
	searchInput.focus()
})

function Search(username) {
	console.log(username)
}

// Display's the data to the the display div
function Display() {
	const displayWindow = document.getElementById("display")
	if (Object.keys(DATA).length === 0) {
		displayWindow.innerHTML = `
	<p style="display: flex; height: 100%; width: 100%; align-items: center; justify-content: center;" >
		Searching...
	</p>`
		return
	}
}

// fetch("https://01.kood.tech/api/graphql-engine/v1/graphql")
// 	.then((response) => response.json())
// 	.then((data) => console.log(data))

searchInput.focus()