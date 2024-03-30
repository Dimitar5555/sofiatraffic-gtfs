const fs = require('fs')
const repo = 'https://raw.githubusercontent.com/Dimitar5555/sofiatraffic-schedules/master/docs/data/';
const outDir = './result';
const GTFSTypes = {
	'metro': 1,
	'tramway': 0,
	'trolleybus': 11,
	'autobus': 3
};

function getJSON(file){
	return fetch(repo+file)
	.then(response => response.json());
}

function arrayToCSV(array){
	return array.map(row => row.map(cell => cell.toString()).join(',')).join('\n');
}

function minsToTime(mins){
	let hour = Math.floor(mins/60).toString().padStart(2, '0');
	let min = (mins%60).toString().padStart(2, '0');
	let secs = '00';
	return `${hour}:${min}:${secs}`
}

if (!fs.existsSync(outDir)){
    fs.mkdirSync(outDir);
}

getJSON('stops.json')
.then(data => {
	let stops_data = [];
	stops_data.push(['stop_id', 'stop_name', 'stop_lat', 'stop_lon']);
	data.forEach(stop => {
		stops_data.push([stop.names.bg.indexOf(',')!=-1?`"${stop.names.bg}"`:stop.names.bg, stop.code, stop.coords[0], stop.coords[1]]);
	});
	fs.writeFileSync(`${outDir}/stops.csv`, arrayToCSV(stops_data));
});

getJSON('routes.json')
.then(data => {
	let routes_data = [];
	routes_data.push(['route_id', 'route_short_name', 'route_type']);
	data.forEach((route, index) => {
		routes_data.push([index+1, route.line, GTFSTypes[route.type]]);
	});
	fs.writeFileSync(`${outDir}/routes.csv`, arrayToCSV(routes_data));
});
var trips;
getJSON('trips.json')
.then(data => {
	let trips_data = [];
	trips = data;
	trips_data.push(['route_id', 'trip_id']);
	data.forEach((trip, index) => {
		trips_data.push([trip.route_index+1, index+1]);
	});
	fs.writeFileSync(`${outDir}/trips.csv`, arrayToCSV(trips_data));
});

var directions;
getJSON('directions.json')
.then(data => {
	directions = data;
});
getJSON('stop_times.json')
.then(data => {
	let stop_times_data = [];
	stop_times_data.push(['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence']);
	data.forEach(stop_times => {
		stop_times.times.forEach((stop_time, index) => {
			stop_times_data.push([stop_times.trip+1, minsToTime(stop_time), minsToTime(stop_time), directions.find(dir => dir.code==trips[stop_times.trip].direction).stops[index], index+1]);

		});
	});
	fs.writeFileSync(`${outDir}/stop_times.csv`, arrayToCSV(stop_times_data));
});
