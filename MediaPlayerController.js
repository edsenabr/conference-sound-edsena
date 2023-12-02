const Interfaces = imports.misc.interfaces;
const Main = imports.ui.main;
const Lang = imports.lang;
const {SignalManager} = imports.misc.signalManager;
const Signals = imports.signals;
const {LogUtils} = require('./LogUtils');
const LOG = new LogUtils(LogUtils.levels.Info, `MediaPlayerController`);
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
const KNOWN_PLAYERS = [
    "banshee",
    "vlc",
    "rhythmbox",
    "spotify"
];

const name_regex = /^org\.mpris\.MediaPlayer2\.(.+)/;
const PLAYER_ACTIONS = ["Next", "Prev", "Play", "Stop"];


class MediaPlayerController {
	constructor(){
        LOG.init();
		this._signalManager = new SignalManager(null);
        this._players = [];
        this._activePlayer = null;

        PLAYER_ACTIONS.forEach( action => {
            Main.keybindingManager.addHotKey(
				`player-controller-${action}`, 
				`Audio${action}`, 
				this._onPlayerAction.bind(this)
			);
        })
        this._dbusConnect();
    }

	_dbusConnect() {
        LOG.init();
        this._dbus = Interfaces.getDBus();
        this._dbus.ListNamesRemote( names => {
            if(!names[0]) {
                return;
            }
            names[0].forEach(name => {
                if (this._getApp(name)) 
                    this._addPlayer(name);
            });
        });
        this._DBusSignalID = this._dbus.connectSignal('NameOwnerChanged', this._onDBusChange.bind(this));
    }

    _getApp(name) {
        let result = name.match(name_regex);
        return result && KNOWN_PLAYERS.includes(result[1])? result[1] : undefined;
    }

    _onDBusChange(proxy, sender, [name, old_instance_id, new_instance_id]) {
        if (!this._getApp(name)) {
            return; 
        }

        /** 
         * let's support only one of app, for simplicity sake, 
         * so we don't need to bother about the dbus owner info. 
        */
        if (this._isInstance(name)) { // 
            return; 
        }

        LOG.init(`name=${name}, old_owner=${old_instance_id}, new_owner=${new_instance_id}`);

        if (new_instance_id && !old_instance_id)
            this._addPlayer(name);
        else if (old_instance_id && !new_instance_id)
            this._removePlayer(name);
    }

    _onPlayerAction(display, something, keybinding) {
        if(!this._activePlayer) {
            return;
        }
        let action = keybinding?.get_name()?.split('-')[2];
		LOG.init(action);
        switch (keybinding.get_name()) {
            case 'player-controller-Next':
                this._activePlayer.NextRemote();
                break;
            case 'player-controller-Prev':
                this._activePlayer.PreviousRemote();
                break;
    
            case 'player-controller-Play':
                this._activePlayer.PlayPauseRemote();
                break;
                    
            case 'player-controller-Stop':
                this._activePlayer.StopRemote();
                break;
        }
    }
    
    _isInstance(name) {
        return /org\.mpris\.MediaPlayer2\..+?\.instance[0-9]+/.test(name);
    }

    _addPlayer(name) {
        LOG.init(name);
        if (this._players.includes(name)) return; // not dealing with instances
        this._players.push(name);
        this.emit('player-opened', name);
        this._changeActivePlayer(name);
		LOG.done();
    }
    _removePlayer(name) {
        LOG.init(this._players);
        this._players = this._players.filter(a => a != name);
        LOG.debug(this._players);
        this.emit('player-closed', name);
        this._changeActivePlayer(this._players[this._players.length - 1]); //undefined if none left
		LOG.done();
    }

    _changeActivePlayer(name) {
        LOG.init(name);
        if (!name) {
            this._activePlayer = undefined;
            return;
        }
        this._activePlayer = Interfaces.getDBusProxyWithOwner(
            MEDIA_PLAYER_2_PLAYER_NAME,
            name
        );
        this.emit('player-changed', name);
		LOG.done();
    }

    destroy() {
        PLAYER_ACTIONS.forEach((action)=> {
			Main.keybindingManager.removeHotKey(`player-controller-${action}`);
        })					
        this._dbus.disconnectSignal(this._DBusSignalID);
    }
}
Signals.addSignalMethods(MediaPlayerController.prototype);