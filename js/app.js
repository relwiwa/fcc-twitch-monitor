/*******************************************************
	USE THE TWITCH.TV JSON API
	-------------------------------------------------------
	A project for FreeCodeCamp's Frontend Certification
	-------------------------------------------------------
	fulfilled by Walter (github.com/relwiwa)
	-------------------------------------------------------
	- I wanted to fulfill this challenge without using
		Angular or any other Framework, but solely jQuery's
		library and me separating M, V and C by myself.
	- This got me from the callback chain of doom to
  	jQuery's promise functionality of doom that does not
		follow common ES6 Promise patterns like, e.g. Q.
	- What made thing's complicated was twitch.tv's API
		returning a request for a non-existent channel with
		a status code of 422, and jQuery's $.when()'s
		behaviour of rejecting the master Deferred-object,
		as soon as one of the Deferred objects it is
		watching gets rejected. Compare with jQuery's
		documentation:
		"In the multiple-Deferreds case where one of the
		Deferreds is rejected, jQuery.when() immediately
		fires the failCallbacks for its master Deferred.
		Note that some of the Deferreds may still be
		unresolved at that point."
		https://api.jquery.com/jquery.when
	- I worked around this issue by adding an addidtional
		always to the Deferred objects $.when watches,
		following lagivan's suggestion on Stackoverflow:
		http://stackoverflow.com/a/30855302/6157647
*******************************************************/

$(document).ready(function() {

	var myTwitch = {};
	
	
	/****************************************************
		MODEL myTwitch.M
		---------------------------------------------------
		- Data of the twitch.tv channels and their streams
			is kept in the model
		- There are two differnt API calls used:
			* https://api.twitch.tv/kraken/channels/xxx
				Used to check existence of channel and get
				general information about a channel (logo,
				url, etc.)
			* https://api.twitch.tv/kraken/streams/xxx
				Used to check the status of a channel, and if
				it is currently streaming, use the information
				about the current stream
	****************************************************/

	myTwitch.M = {
	
		channels: ["freecodecamp", "brunofin", "storbeck", "terakilobyte", "habathcx", "RobotCaleb", "thomasballinger", "noobs2ninjas", "beohoff",  "comster404", "ESL_SC2"],
		
		// twitchs will contain information about channels and streams
		twitchs: {},
		lastChannelsRefresh: null,
		lastStreamsRefresh: null,
	
		/**************************************************
			refreshChannels function
			-------------------------------------------------
			- Function used to setup information about all
				channels
			- Used to find out whether a channel exists or
				not, and to get general information about an
				existing channel
			- Results get stored in twitchs object
			- Returns promise that returns twitchs-object
				after all data has been received
			- API requests are only made, if there isn't
				any data yet, otherwise, twitchs-object is
				returned immediately
			- Unfortunately, API calls have to be made
				individually for each channel
			->	TODO: add refresh behaviour, to update
								channel data depending on
								lastChannelsRefresh
			- Functionality of Deferred's:
				* The outer Deferred d gets returned to the
					calling function and gets resolved, after
					all inner Deferred-objects dd (the API
					calls) in $.when() are fulfilled.
				* Unfortunately, $.when() aborts watching
					the remaining Deferred-objects as soon
					as one on the Deferreds gets rejected.
					As the twitch API returns a failed status
					code for non-existent channels, there was
					need to prevent this.
					That is why all the inner Deferred-
					objects dd have an always()-handler,
					that resolves the inner Deferred dd
					regardless of "success" or "failure" of
					the API call.
		**************************************************/
		
		refreshChannels: function() {
			// dds stores all inner Deferred-objects for usage with $.when()
			var dds = [];
			// Reference to "this"			
			var self = myTwitch.M;
			
			// Outer Deferred-object
			var d = $.Deferred(function(d) {
				
				// Only grab data if there is no data yet				
				if (self.lastChannelsRefresh === null) {
					//console.log("isEmpty");
					
					// Individual API call for each channel in for loop
					for (var i = 0; i < self.channels.length; i++) {
						var current = self.channels[i];
						// inner Deferred object dd contains API call
						var dd = $.Deferred();

						// IIFE necessary to keep reference to current channel and "this"
						(function(current, self) {
							$.get("https://api.twitch.tv/kraken/channels/" + current)
							.done(function(response) {
								// Channel exists, so we mark it as "existent" and use some of its data
								//console.log("channel: " + current + "exists!", response);
								self.twitchs[current] = {};
								self.twitchs[current].inputName = current;
								self.twitchs[current].existence = "existent";
								self.twitchs[current].logo = response.logo;
								self.twitchs[current].url = response.url;
								self.twitchs[current].displayName = response.display_name;
							})
							.fail(function(response) {
								// Channel does not exist, so we mark it as "nonExistent"
								//console.log("channel:" + current + " does not exist!", response);
								self.twitchs[current] = {};
								self.twitchs[current].inputName = current;
								self.twitchs[current].existence = "nonExistent";
							})
							// Always is used like explained above for $.when() to work properly
							.always(dd.resolve);
						})(current, self);
						
						dds.push(dd);
					}
					
					/*	- $.when is used to wait until all the API requests are fulfilled
							- $.when expects objects as input, so apply is needed */
					$.when.apply($, dds)
					.done(function(response) {
						//console.log("allchannelsdone:", response);
						myTwitch.M.lastChannelsRefresh = Date.now();
						d.resolve(myTwitch.M.twitchs);
					});
				}
				// We already got data about the channels, so no API call, just return data
				else {
					//console.log("notempty");
					d.resolve(myTwitch.M.twitchs);
				}
			});
			
			// Return outer promise d
			return d.promise();
		},

		/**************************************************
			refreshStreams function
			-------------------------------------------------
			- Function used to setup information about the
				streams, but solely of existing channels
			- Used to find out whether a channel is
				currently streaming or not, and to get further
				information about a currently ongoing stream
			- Results get added to twitchs object
			- Returns promise that returns twitchs-object
				after all data has been received
			- API requests are only made, if there isn't
				any data yet, otherwise, twitchs-object is
				returned immediately
			- Unfortunately, API calls have to be made
				individually for each channel
			->	TODO: add refresh behaviour, to update
								streams data depending on
								lastStreamsRefresh
			- Functionality of Deferred's is equivalent
				to refreshChannels function
		**************************************************/		
		
		refreshStreams: function() {
			var dds = [];
			var self = myTwitch.M;
			
			var d = $.Deferred(function(d) {
				if (myTwitch.M.lastStreamsRefresh === null) {
					//console.log("noStreamsYet");

					for (var channel in self.twitchs) {
						var current = channel;

						if (self.twitchs[current].existence === "existent") {
							//console.log("channel exists");
							var dd = $.Deferred();
							(function(current, self) {
								$.get("https://api.twitch.tv/kraken/streams/" + current)
								.done(function(response) {
									if (response.stream !== null) {
										//console.log(current + " is online!", response);
										self.twitchs[current].status = "online";
										self.twitchs[current].description = response.stream.channel.status;
									}
									else {
										//console.log(current + " is offline!", response);
										self.twitchs[current].status = "offline";
									}
								})
								.always(dd.resolve);
							})(current, self);
							
							dds.push(dd);
						}
						else {
							//console.log("channel does not exist");
						}
					}
					
					$.when.apply($, dds)
					.done(function(response) {
						//console.log("allstreamsdone:", response);
						myTwitch.M.lastStreamsRefresh = Date.now();
						d.resolve(myTwitch.M.twitchs);
					});
					
				}
				else {
					//console.log("streamsthere");
					d.resolve(myTwitch.M.twitchs);
				}
			});
			
			return d.promise();
		},

	}; // end myTwitch.M


	/****************************************************
		CONTROLLER myTwitch.C
		---------------------------------------------------
		- Used to communication between Model and View
	****************************************************/	
	
	myTwitch.C = {
		

		/**************************************************
			init function
			-------------------------------------------------
			- Initializes setting up channel and streams
				information.
			- When channel and streams information is there,
				View starts to render
		**************************************************/		
	
		init: function() {
			// 1. refreshChannels
			myTwitch.M.refreshChannels()
			// 1.done(2. refreshStreams)
			.then(myTwitch.M.refreshStreams)
			// 2.done(3. renderView)
			.then(function(response) {
				myTwitch.V.init(response);
			});
			
		}
	}; // end myTwitch.C

	
	/****************************************************
		VIEW myTwitch.V
		---------------------------------------------------
		- Responsible for displaying information about
			each channel
	****************************************************/	
	
	myTwitch.V = {
		
		/**************************************************
			init function
			-------------------------------------------------
			- Calls displayChannel function for each
				channel
		**************************************************/		
		
		init: function(input) {
			for (channel in input) {
				this.displayChannel(input[channel]);
				this.setupDropdowns();
			}
		},

		
		/**************************************************
			displayChannel function
			-------------------------------------------------
			- Uses template to create list-group-item for
				the channel entered
			- Differentiates between non-existent, online
				and offline channels
		**************************************************/		
		
		displayChannel: function(channel) {

			// template Variables
			var channelId = channel.inputName;
			var statusClassStyle;
			var statusClassFilter;
			var linkUrl;
			var linkDisabled; // maybe get rid of it
			var logoSrc;
			var channelName;
			var currentStatus;
			var currentStatusPadding  = "";
			
			if (channel.existence === "nonExistent") {
				// template values for non-existent channel
				statusClassStyle = "list-group-item-warning";
				statusClassFilter = "non-existent";
				linkUrl = "";
				linkDisabled = "";
				channelName = channel.inputName;
				currentStatus = "No such channel";
				logoSrc = "http://res.cloudinary.com/dqzrtsqol/image/upload/v1464091895/TwitchGlitchIcon_WhiteonPurple_bt6alc.png";
			}
			
			else {
				// template values shared by all existing channels
				linkUrl = "href='" + channel.url + "' ";
				linkDisabled = "";
				channelName = channel.displayName;
				statusClassFilter = channel.status;
				if (channel.logo) {
					logoSrc = channel.logo;
				}
				else {
					logoSrc = "http://res.cloudinary.com/dqzrtsqol/image/upload/v1464091895/TwitchGlitchIcon_PurpleonWhite_tayh1q.png";
				}
				if (channel.status === "online") {
					// template values for online channels only
					statusClassStyle = "list-group-item-success";
					currentStatus = channel.description;
					console.log(currentStatus.length);
					console.log(currentStatus.length);
					if (currentStatus.length > 70) {
						currentStatusPadding = "twitch-currentstatus-more-rows";
					}
				}
				else {
					// template values for offline channels only
					statusClassStyle = "list-group-item-info";
					currentStatus = "Channel is currently offline";
				}
			}
			
			var template =
					"<a id='" + channelId + "' " + linkUrl + "class='list-group-item " + linkDisabled + statusClassStyle + " " + statusClassFilter + "'>" +
					"  <div class='row'>" +
					"	   <span class='col col-xs-12 col-sm-2 twitch-logo'><img src='" + logoSrc + "' /></span>" +
					"    <span class='col col-xs-12 col-sm-3 twitch-channelname'>" + channelName + "</span>" +
					"    <span class='col col-xs-12 col-sm-7 " + currentStatusPadding + " twitch-currentstatus'>" + currentStatus + "</span>" +
					"  </div>" +
					"</a>";
			
			$("#display-channels").append(template);

		},
		
		/**************************************************
			setupDropdowns function
			-------------------------------------------------
			- Setup dropdowns
			- Add event listener to filter channel entries
			- Show footer
		**************************************************/		
		
		setupDropdowns: function() {
			$(".filter-online").click(function() {
				$("#display-channels").removeClass().addClass("online");
				$(".dropdown-current").text("Online");
			});
			$(".filter-offline").click(function() {
				$("#display-channels").removeClass().addClass("offline");
				$(".dropdown-current").text("Offline");
			});
			$(".filter-non-existent").click(function() {
				$("#display-channels").removeClass().addClass("non-existent");
				$(".dropdown-current").text("Not Existing");
			});
			$(".filter-all").click(function() {
				$("#display-channels").removeClass().addClass("all");
				$(".dropdown-current").text("All Channels");
			});
			$("#footer").show();
		}
		
		
	} // end myTwitch.V

	
	myTwitch.C.init();
	
});