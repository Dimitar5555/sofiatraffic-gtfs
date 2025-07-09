import fs from 'fs';
import zipper from 'zip-local';

const repo = 'https://raw.githubusercontent.com/Dimitar5555/sofiatraffic-schedules/master/docs/data/';
const outDir = './result';
const GTFSTypes = {
	'metro': 1,
	'tram': 0,
	'trolley': 11,
	'bus': 3
};
const BGTypes = {
	'metro': 'Метролиния',
	'tram': 'Трамвай',
	'trolley': 'Тролейбус',
	'bus': 'Автобус'
};
const BGShortTypes = {
	"metro": "",
	"tram": "ТМ",
	"trolley": "ТБ",
	"bus": "А"
};
const GTFSConsts = {
	agency: {
		name: 'Център за градска мобилност',
		site: 'https://sofiatraffic.bg'
	},
	timezone: 'Europe/Sofia',
	lang: 'bg'
};
const RouteColors = {
	'M1': 'EC2029',
	'M2': '1077BC',
	'M3': '3BB44B',
	'M4': 'FCD403',

	'tram': 'F6921E',
	'trolley': '0095DA',
	'bus': 'BE1E2D',
};
const RouteTextColors = {
	'M1': 'FFFFFF',
	'M2': 'FFFFFF',
	'M3': 'FFFFFF',
	'M4': '000000',

	'tram': 'FFFFFF',
	'trolley': 'FFFFFF',
	'bus': 'FFFFFF',
};

function getJSON(file) {
	return fetch(repo+file)
	.then(response => response.json());
}

function arrayToCSV(array) {
	console.log(array.filter(ar => ar.includes(undefined)))
	return array.map(row => row.map(cell => cell.toString()).join(',')).join('\n');
}

function minsToTime(mins) {
	let hour = Math.floor(mins/60).toString().padStart(2, '0');
	let min = (mins%60).toString().padStart(2, '0');
	let secs = '00';
	return `${hour}:${min}:${secs}`
}

function saveToFile(name, data) {
	let path = `${outDir}/${name}.txt`;
	fs.writeFileSync(path, arrayToCSV(data) + '\n');
	console.log(`Done writing to ${path}`);
}

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
}

getJSON('stops.json')
.then(data => {
	let stops_data = [];
	stops_data.push(['stop_id', 'stop_name', 'stop_lat', 'stop_lon']);
	data.forEach(stop => {
		const stop_code = stop.code;
		const name = stop.names.bg.includes(',') ? `"${stop.names.bg}"` : stop.names.bg;
		const lat = stop.coords[0];
		const lon = stop.coords[1];
		
		stops_data.push([stop_code, name, lat, lon]);
	});
	saveToFile('stops', stops_data);
	return data;
});

const routes = await getJSON('routes.json')
.then(data => {
	let routes_data = [];
	routes_data.push(['agency_id', 'route_id', 'route_short_name', 'route_long_name', 'route_type', 'route_text_color', 'route_color']);
	data.forEach((route, index) => {
		const agency_id = 1;
		const route_id = `${BGShortTypes[route.type]}${route.route_ref}`;
		const route_short_name = route.route_ref;
		const route_long_name = `${BGTypes[route.type]} ${route.route_ref}`;
		const route_type = GTFSTypes[route.type];
		const route_text_color = RouteTextColors[route.type == 'metro' ? route.route_ref : route.type];
		const route_color = RouteColors[route.type == 'metro' ? route.route_ref : route.type];

		routes_data.push([agency_id, route_id, route_short_name, route_long_name, route_type, route_text_color, route_color]);
	});
	saveToFile('routes', routes_data);
	return data;
});



let local_promises = [];
local_promises.push(getJSON('trips.json'));
local_promises.push(getJSON('directions.json'));
local_promises.push(getJSON('stop_times.json'));


Promise.all(local_promises)
.then((datas) => {
	const trips = datas[0];
	const directions = datas[1];
	const all_stop_times = datas[2];
	
	let trips_data = [];
	trips_data.push(['route_id', 'service_id', 'trip_id']);
	
	let stop_times_data = [];
	stop_times_data.push(['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence']);
	
	let trip_counter = 0;
	all_stop_times.forEach(stop_times => {
		trip_counter++;
		const route = routes[trips[stop_times.trip].route_index];
		if(!route){
			return;
		}
		const route_id = `${BGShortTypes[route.type]}${route.route_ref}`;
		const calendar_val = trips[stop_times.trip].is_weekend ? 2 : 1;
		trips_data.push([route_id, calendar_val, trip_counter]);
		const stops = directions.find(dir => dir.code === trips[stop_times.trip].direction).stops;
		const startTime = stop_times.times.find(time => typeof time === 'number');
		const times_to_commit = [];
		stop_times.times.forEach((stop_time, index) => {
			if(typeof stop_time !== 'number') {
				return;
			}
			if(stops.length<index+1){
				return;
			}
			if(startTime > stop_time) {
				stop_time += 24*60;
			}
			times_to_commit.push([trip_counter, stop_time, stop_time, stops[index], index+1]);
		});
		for(let i = 1; i < times_to_commit.length-1; i++) {
			const prev = times_to_commit[i-1][1];
			const curr = times_to_commit[i][1];
			const next = times_to_commit[i+1][1];
			if(prev < curr && next < curr) {
				times_to_commit[i][1] = next;
				times_to_commit[i][2] = next;

				times_to_commit[i+1][1] = curr;
				times_to_commit[i+1][2] = curr;
			}
		}
		times_to_commit.forEach(time => {
			time[1] = minsToTime(time[1]);
			time[2] = minsToTime(time[2]);
			stop_times_data.push(time);
		});
	});

	saveToFile('trips', trips_data);
	saveToFile('stop_times', stop_times_data);
})
.finally(() => {
	console.log('Almost done, zipping files.');
	zipper.sync.zip("./result/").compress().save("result.zip");
	console.log('Zipped data to result.zip');
})
{
	let agencies = [];
	agencies.push(['agency_id', 'agency_name', 'agency_url', 'agency_timezone']);
	agencies.push([1, GTFSConsts.agency.name, GTFSConsts.agency.site, GTFSConsts.timezone]);
	saveToFile('agency', agencies);
}
{
	let feed_info = [];
	feed_info.push(['feed_publisher_name', 'feed_publisher_url', 'feed_lang']);
	feed_info.push([GTFSConsts.agency.name, GTFSConsts.agency.site, GTFSConsts.lang]);
	saveToFile('feed_info', feed_info);
}
{
	let calendar = [];
	calendar.push(['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date']);
	let year = new Date().getFullYear();
	calendar.push([1, 1, 1, 1, 1, 1, 0, 0, `${year}0101`, `${year}1231`]);
	calendar.push([2, 0, 0, 0, 0, 0, 1, 1, `${year}0101`, `${year}1231`]);
	saveToFile('calendar', calendar);
}

