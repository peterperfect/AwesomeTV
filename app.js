var express = require('express'),
mongoose = require('mongoose'),
TVDB = require('tvdb'),
jade = require('jade');
app = express.createServer();
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set('view options', {layout:true});
app.configure(function(){
	app.use(express['static'](__dirname + '/public'));
	app.use(app.router);
});
var config = require('./config.js').config;
if(config){
	try{
		mongoose.connect('mongodb://' + config['db']['host'] + '/' + config['db']['database'] + '');
		tvdb = new TVDB({apiKey: config['api']['tvdb']});
	}catch(e){
		throw new Error('Database does not exist!');
	}
}else{
	throw new Error('Please make a config file, look at config.example.js.');
}
var Schema = mongoose.Schema;
// TV Show listings
var Show = function Show(name){
	this.schema = new Schema({
		show: {type: String},
		tvdbID: {type: Number},
		name: {type: String},
		number: {type: Number, default: 1},
		season: {type: Number, default: 1}
	});
	this.name = name;
}
//console.log(new Show('test'));
Show.prototype.getEpisodes = function getEpisodes(callback, res){
	var self = this;
	getShow(self.name, function(show){
		self.tvdbID = show.tvdbID;
		var myModel = mongoose.model('episodes', self.schema);
		var eps = [];
		myModel.find({'show': self.name}, function (err, docs) {
			docs.forEach(function(ep){
				eps.push(ep);
			});
			// If this show has no episodes, fetch them.
			if(eps.length == 0){
				self.fetchEpisodes(self.tvdbID, res);
			}else{
				callback(eps);
			}
		});
	});
};
Show.prototype.fetchEpisodes = function fetchEpisodes(tvdbID, res){
	var self = this;
	console.log('Fetching episodes...');
	tvdb.getInfo(tvdbID, function(err, data){
		if(err){
			throw err;
		}else if(!data){
			throw new Error('[TVDB] TVDB ID does not exist!');
		}
		var episodes = data.episodes;
		[].forEach.call(episodes, function(episode){
			var instance = {};
			instance.tvdbID = episode.EpisodeId;
			instance.name = episode.EpisodeName;
			instance.season = episode.Season;
			instance.number = episode.Episode;
			self.addEpisode(instance.tvdbID, instance.name, instance.season, instance.number, res);
		});
	});
}
Show.prototype.addEpisode = function addEpisode(tvdbID, name, season, number, res){
	var myModel = mongoose.model('episodes', this.schema);
	var instance = new myModel();
	instance.show = this.name;
	instance.tvdbID = tvdbID;
	instance.name = name;
	instance.season = season;
	instance.number = number;
	instance.save(function(){
		res.send('<meta http-equiv="refresh" content="0">');
	});
}
function getShow(name, callback){
	var mySchema = new Schema({
		name: {type: String},
		tvdbID: {type: Number},
		overview: {type: String}
	});
	var myModel = mongoose.model('shows', mySchema);
	myModel.find({'name': name}, function (err, docs) {
		if(err){
			throw err;
		}
		if(docs){
			show = docs[0];
			callback(show);
		}
	});
}
function getShows(callback){
	var mySchema = new Schema({
		name: {type: String},
		tvdbID: {type: Number},
		overview: {type: String}
	});
	var myModel = mongoose.model('shows', mySchema);
	var shows = [];
	myModel.find({}, function (err, docs) {
		docs.forEach(function(show){
			shows.push(show);
		});
		callback(shows);
	});
}
function addShow(name, res){
	var mySchema = new Schema({
		name: {type: String},
		tvdbID: {type: String},
		overview: {type: String}
	});	
	var myModel = mongoose.model('shows', mySchema);
	var instance = new myModel();
	if(name){
		tvdb.findTvShow(name, function(err, tvShows){
			if(tvShows.length == 0){
				throw new Error('[TVDB] No TV show returned!');
			}else if(tvShows.length > 1){
				//throw new Error('[TVDB] More than one TV show returned!');
			}
			var tvshow = tvShows[0];
			instance.name = tvshow.name;
			instance.tvdbID = tvshow.id;
			instance.overview = tvshow.overview;
			instance.save(function(err){
				if(err) throw err;
				res.send('{type: \'success\'}');
			});
		});
	}else{
		res.send('{type: \'error\', message: \'Name or IMDB ID not specified.\'}');
	}
}
app.get('/', function(req, res){
	var shows = getShows(function(shows){
		res.render('shows', {shows: shows});
	});
});
app.get('/show/:show', function(req, res){
	var show = new Show(req.params.show);
	show.getEpisodes(function(eps){
		res.render('episodes', {showName: req.params.show, eps: eps})
	}, res);
});
// API
app.get('/api/getShow/:show', function(req, res){
	var show = new Show(req.params.show);
	show.getEpisodes(function(eps){
		res.send('{showName: ' + req.params.show + ', eps: ' + eps + '}');
	});
});
app.get('/api/addShow/:name', function(req, res){
	if(req && req.params.name){
		addShow(req.params.name, res);
	}
});
app.listen(1337, function(){
	console.log('AwesomeTV is running on port 1337.');
});