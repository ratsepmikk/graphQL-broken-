// // curl "https://01.kood.tech/api/graphql-engine/v1/graphql" --data '{"query":"{user(where:{id:{_eq:6}}){id login}}"} Karin Künnapas 
const baseURL = "https://01.kood.tech/api/graphql-engine/v1/graphql"

const searchForm = document.getElementById("user-search-form")
const searchInput = document.getElementById("user-search")
searchInput.focus()

const DATA = {}

searchForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const targetUsername = searchInput.value
	// if (targetUsername !== "") {
		Search(targetUsername)
		// Display()
		searchInput.value = ""
	// }
	searchInput.focus()
})

function Search(username) {
	console.log(username)

	fetch(baseURL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query: `
			{
				user( where: { login: { _eq: ${username} } } ) {
					id
					login
				}
				others: user( where: { login: { _neq: "liki123" } }, offset: ${8400} ) {
					id
					login
				}
			}`,
			variables: {}
		})
	})
		.then((response) => response.json())
		.then((data) => console.log(data))
}

// // Display's the data to the the display div
// function Display() {
// 	const displayWindow = document.getElementById("display")
// 	if (Object.keys(DATA).length === 0) {
// 		displayWindow.innerHTML = `
// 	<p style="display: flex; height: 100%; width: 100%; align-items: center; justify-content: center;" >
// 		Searching...
// 	</p>`
// 		return
// 	}
// }

// var { graphql, buildSchema } = require('graphql');

// // Construct a schema, using GraphQL schema language
// var schema = buildSchema(`
//   type Query {
//     hello: String
//   }
// `);

// // The rootValue provides a resolver function for each API endpoint
// var rootValue = {
//   hello: () => {
//     return 'Hello world!';
//   },
// };

// // Run the GraphQL query '{ hello }' and print out the response
// graphql({
//   schema,
//   source: '{ hello }',
//   rootValue
// }).then((response) => {
//   console.log(response);
// });

// query GetLearnWithJasonEpisodes($now: DateTime!) {
//   allEpisode(sort: {date: ASC}, where: {date: {gte: $now}}) {
//     date
//     title
//     guest {
//       name
//       twitter
//     }
//     description
//   }
// }