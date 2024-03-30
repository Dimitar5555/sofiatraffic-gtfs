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
const GTFSConsts = {
	agency: {
		name: 'Център за градска мобилност',
		site: 'https://sofiatraffic.bg'
	},
	timezone: 'Europe/Sofia',
	lang: 'bg'
}
var promises = [];

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
	return fs.writeFile(`${outDir}/${name}.txt`, arrayToCSV(data), (err)=>{
		if(err){
			console.error(err)
		}
	});
}

if (!fs.existsSync(outDir)){
    fs.mkdirSync(outDir);
}

promises.push(
	getJSON('stops.json')
	.then(data => {
		let stops_data = [];
		stops_data.push(['agency_id', 'stop_id', 'stop_name', 'stop_lat', 'stop_lon']);
		data.forEach(stop => {
			stops_data.push([1, stop.code, stop.names.bg.indexOf(',')!=-1?`"${stop.names.bg}"`:stop.names.bg, stop.coords[0], stop.coords[1]]);
		});
		saveToFile('stops', stops_data);
	}
));

promises.push(
	getJSON('routes.json')
	.then(data => {
		let routes_data = [];
		routes_data.push(['agency_id', 'route_id', 'route_short_name', 'route_type']);
		data.forEach((route, index) => {
			routes_data.push([1, index+1, route.line, GTFSTypes[route.type]]);
		});
		saveToFile('routes', routes_data);
	}
));


var trips;
var directions;
promises.push(
	getJSON('trips.json')
	.then(data => {
		trips = data;
		return getJSON('directions.json');
	})
	.then(data => {
		directions = data;
		return getJSON('stop_times.json');
	})
	.then(data => {
		let last_trip = 0;
		let stop_times_data = [];
		trips_data.push(['route_id', 'service_id', 'trip_id']);
		let trips_data = [];
		stop_times_data.push(['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence']);
		data.forEach(stop_times => {
			last_trip++;
			trips_data.push([trips[stop_times.trip].route_index+1, 1, last_trip]);
			let stops = directions.find(dir => dir.code==trips[stop_times.trip].direction).stops;
			stop_times.times.forEach((stop_time, index) => {
				stop_times_data.push([last_trip, minsToTime(stop_time), minsToTime(stop_time), stops[index], index+1]);
			});
		});
		promises.push(saveToFile('stop_times', stop_times_data));
		promises.push(saveToFile('trips', trips_data));
	})
);
{
	let agencies = [];
	agencies.push(['agency_id', 'agency_name', 'agency_url', 'agency_timezone']);
	agencies.push([1, GTFSConsts.agency.name, GTFSConsts.agency.site, GTFSConsts.timezone]);
	promises.push(saveToFile('agency', agencies));
}
{
	let feed_info = [];
	feed_info.push(['feed_publisher_name', 'feed_publisher_url', 'feed_lang']);
	feed_info.push([GTFSConsts.agency.name, GTFSConsts.agency.site, GTFSConsts.lang]);
	promises.push(saveToFile('feed_info', feed_info));
}
{
	let calendar = [];
	calendar.push(['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date']);
	let year = new Date().getFullYear();
	calendar.push([1, 1, 1, 1, 1, 1, 1, 1, `${year}-01-01`, `${year}-12-31`]);
	promises.push(saveToFile('calendar', calendar));
}

Promise.all(promises)
.then(() => {
	zipper.sync.zip("./result/").compress().save("result.zip");
});
