# [@iBotSunburn](https://twitter.com/iBotSunburn). The twitter bot 🤖 that slaps your sunburn 🌞. Hard 😳.

## Summary

The [@iBotSunburn](https://twitter.com/iBotSunburn) bot helps you:

* Looking for people who recently twited `I got sunburn` and post a random sunburn meme with gif media to acclaim their "success" 
* Respond to followers
* Respond to responses
* Respond to mentions

The bot is an awesome add-on to any startup, like [UVIMate - Sun Safety Coach app](https://uvimate.com). 

## How to run
* Change `config.js` to set Twitter API keys
* Change `config.js` to set Giphy API key
* Run:

```
npm run start
```

## Deployment

* Get free Heroku account
* Add Heroku Redis add-on, `App -> Resources -> Redis`
* Push sources to Heroku Git master branch
```
git push heroku master
```

* Activate worker, `App -> Resources -> Free Dynos -> Worker -> Edit -> Switch off`
* Deactivate web, `App -> Resources -> Free Dynos -> Web -> Edit -> Switch on`
* Restart all dynos

## Built With

* [NodeJS](https://nodejs.org/en/)
* [Twit](https://github.com/ttezel/twit)
* [GiphyAPI](https://developers.giphy.com/docs/)
* [Heroku](https://heroku.com)

## Author

* [aershov24](https://github.com/aershov24) for [UVIMate - Sun Safety Coach app](https://uvimate.com) project


## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT)
