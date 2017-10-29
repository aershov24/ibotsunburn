var twit = require('twit');
var config = require('./config.js');
var log4js = require('log4js');
var logger = log4js.getLogger();
var forEach = require('async-foreach').forEach;
var Twitter = new twit(config.twitter);
var dateFormat = require('dateformat');
var random = require('random-js')();
var redis = require('redis');
var fs = require('fs');
var path = require('path');
var request = require('request');
var giphy = require('giphy-api')(config.giphy.api);
var randomItem = require('random-item');
const uuidV1 = require('uuid/v1');

client = redis.createClient(process.env.REDIS_URL || '');
logger.level = 'all';

var TWITTER_SEARCH_PHRASE = 'i got sunburn AND -filter:replies AND -filter:retweets';
var TWITTER_SEARCH_TYPE = 'recent';
var TWITTER_SEARCH_COUNT = 7;

var SUNBURN_MEMES = [
    'Hw r u doin guys?',
    'The beach was gr8?',
    'every1 gets a sunburn!!!',
    'From taking a walk at nite!',
    'Went outside on a cloudy day?',
    'Sunburn level tomato!',
    'nbdy called me a lobster!',
    'DYK sunburn is caused by the sun?',
    'Sunburn, Sunburn Everywhere!',
    'Slaps it!',
    'Happy peeling guys!',
    'The sun is not our frnd!',
    'r u ready 4 peeling?',
    'wot duz sunburn feel like?']

var SUNBURN_TWEET = 'It seems {array} got sunburn 2day! {meme}'
var REPLY_TWEET = 'Hey @{screen_name}! Wanna 2 stay sunburn free anytime, anywhere? Get ur Sun Safety Coach app now => http://uvimate.com'
var WELCOME_TWEET = 'thx 4 following @{screen_name}! Wanna 2 stay sunburn free anytime, anywhere? Get ur Sun Safety Coach app now => http://uvimate.com'

var BOT_SCREEN_NAME = 'ibotsunburn'
var REDIS_SUNBURNED_KEY = 'sunburnedPeople';
var REDIS_MENTIONS_KEY = 'mentionedIn';
var DEBUG = false;

var sunburnScreenNames = []
var today = new Date();

var gifLimit = 100
var gifOffset = 0

// START: ====== POST TO WITTER WITH GIF ======

var postWithGif = function(gifTopic, text, callback)
{
    // Search with options using promise 
    giphy.search({q: gifTopic, limit: gifLimit, offset: gifLimit*random.integer(0, gifOffset)}).then(function (res) {
        var gifUrl = res.data[random.integer(0, gifLimit-1)].images.original.url
        logger.trace('Random gif found: '+ gifUrl);

        var filename = uuidV1()+'.gif'
        var mp4stream = request(gifUrl).pipe(fs.createWriteStream('gifs/'+filename));
        mp4stream.on('finish', function () {
            console.log('Gif safed...');
            var pathToVideo = path.join(__dirname, 'gifs/'+filename);
            console.log(pathToVideo);

            Twitter.postMediaChunked({ file_path: pathToVideo }, function (err, data, response) {
                if (err)
                    return logger.error(err);

                logger.trace('Gif uploaded...');
                fs.unlinkSync(pathToVideo);

                var opts = {
                    media_ids: [data.media_id_string],
                    status: text,
                }

                if (!DEBUG){
                    Twitter.post('statuses/update', opts, function(err, reply) {
                        callback(err);
                    });
                }
            })
        });
    })
}

var replyWithGif = function(gifTopic, toScreenName, toTwitId, text, callback)
{
    // Search with options using promise 
    giphy.search({q: gifTopic, limit: gifLimit, offset: gifLimit*random.integer(0, gifOffset)}).then(function (res) {
        var gifUrl = res.data[random.integer(0, gifLimit-1)].images.original.url
        logger.trace('Random gif found: '+ gifUrl);

        var filename = uuidV1()+'.gif'
        var mp4stream = request(gifUrl).pipe(fs.createWriteStream('gifs/'+filename));
        mp4stream.on('finish', function () {
            console.log('Gif safed...');
            var pathToVideo = path.join(__dirname, 'gifs/'+filename);
            console.log(pathToVideo);

            Twitter.postMediaChunked({ file_path: pathToVideo }, function (err, data, response) {
                if (err)
                    return logger.error(err);

                console.log('Gif uploaded...');
                fs.unlinkSync(pathToVideo);
                console.log(data)

                var opts = {
                    media_ids: [data.media_id_string],
                    in_reply_to_status_id: toTwitId, 
                    status: text.replace('{screen_name}', toScreenName),
                }

                if (!DEBUG){
                    Twitter.post('statuses/update', opts, function(err, reply) {
                        callback(err);
                    });
                }
            })
        });
    })
}
// POST: ====== POST TO WITTER WITH GIF ======

// START: ====== POST TO SUNBURN ======
var postSunburnTwit = function() {
    if (sunburnScreenNames.length > 0){
        logger.trace('Building post...'); 

        if (!DEBUG){
            postWithGif(
                'sunburn', 
                SUNBURN_TWEET.replace('{array}', sunburnScreenNames.join(" ")).replace('{meme}', randomItem(SUNBURN_MEMES)),
                function(err){
                    if (err)
                       return logger.error('err');
                    logger.trace('Replied to sunburned...');
                }); 
        }
    } else {
         logger.trace('Nothing to post...');
    }
}

var checkScreenName = function(screenName, callback) {
    logger.debug('Check screenName: '+screenName);

    if (!DEBUG){
        client.sadd(REDIS_SUNBURNED_KEY, screenName, function(err, reply) {
            if (err)
                return logger.error(err);

            if (reply == 1) { // new screenName
                logger.debug('Add screenName: '+screenName);
                callback(true, screenName)
            }
            else{
                logger.debug('Skip screenName: '+screenName);
                callback(false, screenName)
            }
        });
    } else {
        logger.debug('Add screenName: '+screenName);
        callback(true, screenName)
    }
}

var collectScreenNames = function(tweets, index){
    if (index < tweets.length) {
        var tweet = tweets[index];

        if (tweet.user.screen_name == BOT_SCREEN_NAME)
        {
            logger.debug('Skip own tweet...');
            collectScreenNames(tweets, index+1);
        }
        else{
            logger.trace('['+tweet.user.screen_name+' tweeted]: '+ tweet.text);
            checkScreenName(tweet.user.screen_name, function(isNew, screenName){
                if (isNew){
                    logger.debug('Push to array: '+screenName);
                    sunburnScreenNames.push('@'+screenName);
                }
                collectScreenNames(tweets, index+1);
            });
        }
    }
    else
    {
        postSunburnTwit();
    }
}

// find latest tweet according the query 'q' in params
var searchSunburnTweets = function() {
    // clear prev sunburnScreenNames
    sunburnScreenNames = [];

    var params = {
        q: TWITTER_SEARCH_PHRASE,  // REQUIRED
        result_type: TWITTER_SEARCH_TYPE,
        lang: 'en',
        count: TWITTER_SEARCH_COUNT
    }

    logger.debug('Search "I Got Sunburn" tweets: '+TWITTER_SEARCH_PHRASE);
    // for more parameters, see: https://dev.twitter.com/rest/reference/get/search/tweets

    Twitter.get('search/tweets', params, function(err, data) {
        if (err)
            return logger.error(err);

        if (data.statuses.length == 0)
            return logger.debug("No tweets found");

        logger.trace("Tweets found: "+ data.statuses.length);
        collectScreenNames(data.statuses, 0);
    });
}
// END: === POST TO SUNBURN

// START: === REPLY TO FOLLOW
var replyToFollow =  function(event) {
    var name = event.source.name;
    var screenName = event.source.screen_name;
    if (screenName != BOT_SCREEN_NAME) {
        logger.trace('Bot was followed by: ' + screenName);

        if (!DEBUG){
            postWithGif(
                'sunburn', 
                WELCOME_TWEET.replace('{screen_name}', screenName),
                function(err){
                    if (err)
                       return logger.error('err');
                    logger.trace('Welcome...');
                }); 
        }
    }
}
// END: === REPLY TO FOLLOW

// START: === REPLY TO REPLY
var replyToReplies = function(tweet) {
    var reply_to = tweet.in_reply_to_screen_name;
    // Check to see if this was, in fact, a reply to you
    if (reply_to === BOT_SCREEN_NAME) {
        // Get the username and content of the tweet
        var screenName = tweet.user.screen_name;
        if (!DEBUG){
            postWithGif(
                'sunburn', 
                REPLY_TWEET.replace('{screen_name}', screenName),
                function(err){
                    if (err)
                       return logger.error(err);
                    logger.trace('Welcome...');
                }); 
        }
    }
}
// END: === REPLY TO REPLY

// START: === POST TO MENTIONS
var searchMentions = function(){
  Twitter.get('/statuses/mentions_timeline', { count: 2 }, function(err, data){
    if(err)
        return logger.error(err);
    if (data.length){
        for (var i = 0; i < data.length; i++){
            var currentTweet = data[i];
            //the object added to latestMentions array
            var tweetObj = {};
            tweetObj.screen_name =  currentTweet.user.screen_name;
            tweetObj.text = currentTweet.text;
            tweetObj.id = currentTweet.id_str;
            
            if (!DEBUG){
                client.sadd(REDIS_MENTIONS_KEY, tweetObj.id , function(err, reply) {
                    if (err)
                        return logger.error(err);

                    if (reply == 1) { // new mentions_id
                        logger.trace('Mentioned in: ' + tweetObj.id);
                        logger.trace('Mentioned by: ' + tweetObj.screen_name);
                        logger.trace('Mentioned tweet: ' + tweetObj.text);

                        replyWithGif(
                            'sunburn', 
                            tweetObj.screen_name, 
                            tweetObj.id, 
                            REPLY_TWEET,
                            function(err){
                                if (err)
                                    return logger.error('err');
                                logger.trace('Replied...');
                            });
                    }
                    else {
                        logger.trace('Skip mention...');
                    }
                });
            }
            else{
                logger.trace('Mentioned in: ' + tweetObj.id);
                logger.trace('Mentioned by: ' + tweetObj.screen_name);
                logger.trace('Mentioned tweet: ' + tweetObj.text);
            }
        } 
    }

    });
};
// END: === POST TO MENTIONS

// MAIN: Bot Loop
var dir = './gifs';

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

logger.debug("== @iBotSunburn Started ==");
logger.debug("DEBUG: "+DEBUG);

searchSunburnTweets();
setInterval(function() { searchSunburnTweets(); }, 60000*10); // check every 10 minutes
logger.debug('Listen sunburned users...');

var stream = Twitter.stream('user');
stream.on('follow', replyToFollow);
logger.debug('Listen followers...');

stream.on('tweet', replyToReplies);
logger.debug('Listen replies...');

setInterval(function() { searchMentions() }, 6000*10*10); // check every 10 minutes
logger.debug('Listen mentions...');


