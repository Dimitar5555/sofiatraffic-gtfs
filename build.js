const fs = require('fs');
const zipper = require('zip-local');
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

function saveToFile(name, data){
	fs.writeFileSync(`${outDir}/${name}.txt`, arrayToCSV(data));
}

if (!fs.existsSync(outDir)){
    fs.mkdirSync(outDir);
}

getJSON('stops.json')
.then(data => {
	let stops_data = [];
	stops_data.push(['agency_id', 'stop_id', 'stop_name', 'stop_lat', 'stop_lon']);
	data.forEach(stop => {
		stops_data.push([1, stop.code, stop.names.bg.indexOf(',')!=-1?`"${stop.names.bg}"`:stop.names.bg, stop.coords[0], stop.coords[1]]);
	});
	saveToFile('stops', stops_data);
});

getJSON('routes.json')
.then(data => {
	let routes_data = [];
	routes_data.push(['agency_id', 'route_id', 'route_short_name', 'route_type']);
	data.forEach((route, index) => {
		routes_data.push([1, index+1, route.line, GTFSTypes[route.type]]);
	});
	saveToFile('routes', routes_data);
});
var trips;
getJSON('trips.json')
.then(data => {
	trips = data;
});

var directions;
getJSON('directions.json')
.then(data => {
	directions = data;
});
getJSON('stop_times.json')
.then(data => {
	let last_trip = 1;
	let stop_times_data = [];
	let trips_data = [];
	trips_data.push(['route_id', 'service_id', 'trip_id']);
	stop_times_data.push(['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence']);
	data.forEach(stop_times => {
		last_trip++;
		trips_data.push([trips[stop_times.trip].route_index+1, 1, last_trip]);
		let stops = directions.find(dir => dir.code==trips[stop_times.trip].direction).stops;
		stop_times.times.forEach((stop_time, index) => {
			stop_times_data.push([last_trip, minsToTime(stop_time), minsToTime(stop_time), stops[index], index+1]);
		});
	});
	saveToFile('stop_times', stop_times_data);
	saveToFile('trips', trips_data);
});

{
	function getLastSunday(year, month) {
		let d = new Date(year, month, 0);
		d.setDate(d.getDate() - d.getDay());
		return d;
	}

	let today = new Date();
	let dst_start = getLastSunday(today.getFullYear(), 3);
	let dst_end = getLastSunday(today.getFullYear(), 11);
	let is_dst = dst_start <= today && today <= dst_end;
	let offset = is_dst?3:2;
	let agencies = [];
	agencies.push(['agency_id', 'agency_name', 'agency_url', 'agency_timezone']);
	agencies.push([1, "Център за градска мобилност", "https://sofiatraffic.bg", offset]);
	saveToFile('agency', agencies);
}
{
	let feed_info = [];
	feed_info.push(['feed_publisher_name', 'feed_publisher_url', 'feed_lang']);
	feed_info.push(['Център за градска мобилност', 'https://sofiatraffic.bg', 'bul']);
	saveToFile('feed_info', feed_info);
}
{
	let calendar = [];
	calendar.push(['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date']);
	let year = new Date().getFullYear();
	calendar.push([1, 1, 1, 1, 1, 1, 1, 1, `${year}-01-01`, `${year}-12-31`]);
	saveToFile('calendar', calendar);
}

zipper.sync.zip("./result/").compress().save("result.zip");
