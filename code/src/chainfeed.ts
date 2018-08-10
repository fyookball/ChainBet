var eventsource = require('eventsource');

export class Chainfeed {

	static listen(onData: (data: any) => void, onConnected: (error: any) => void, onDisconnect: (error: any) => void) {
		let source = new eventsource('https://chainfeed.org/stream');
		source.addEventListener('message', function(e: MessageEvent) {
			var m = JSON.parse(e.data);
			onData(m.data);
		}, false)
		source.addEventListener('open', function(e: MessageEvent) {
			//console.log("Chainfeed Connected");
			if(onConnected != undefined){
					onConnected(e);
			}
		}, false)
		source.addEventListener('error', function(e: MessageEvent) {
			if (e) { //.target.readyState == EventSource.CLOSED) {
				//console.log("Chainfeed Disconnected", e);
				if(onDisconnect != undefined){
					onDisconnect(e);
				}
			}
			// else if (e.target.readyState == EventSource.CONNECTING) {
			//   //console.log("Chainfeed is connecting...", e);
			// }
		}, false)
	}

	recent(size: number, callback: () => void) {
		this._req('https://chainfeed.org/recent/' + size, callback);
	}

	range(start: number, end: number, callback: () => void) {
		this._req('https://chainfeed.org/range/' + start + ',' + end, callback);
	}

	tx(hash: string, callback: () => void) {
		this._req('https://chainfeed.org/tx/' + hash);
	}

	_req(endpoint: string, callback?: (res: string) => void) {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', endpoint);
		xhr.responseType = 'json';
		xhr.onload = function(e: any) {
			if (this.status == 200 && callback != undefined) {
				callback(this.response);
			}
		};
		xhr.send();
	}
}