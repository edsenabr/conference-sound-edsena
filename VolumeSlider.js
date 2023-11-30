const Clutter = imports.gi.Clutter;
const Cvc = imports.gi.Cvc;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;

var VOLUME_ADJUSTMENT_STEP = 0.05; /* Volume adjustment step in % */


class VolumeSlider extends PopupMenu.PopupSliderMenuItem {
	constructor(magneticOn, volumeMax, volumeNorm, tooltip, app_icon) {
			super(0);
			this.magneticOn = magneticOn;
			this.volumeMax = volumeMax;
			this.volumeNorm = volumeNorm;

			this.setTooltipText(tooltip);
			this.set_mark(volumeNorm / volumeMax);


			this.icon = new St.Icon({icon_name: app_icon, icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon'});

			this.removeActor(this._slider);
			this.addActor(this.icon, {span: 0});
			this.addActor(this._slider, {span: -1, expand: true});
	}

	setTooltipText(text){
		if(!this.tooltip) {
			this.tooltip = new Tooltips.Tooltip(this.actor, "");
			this.tooltipText = (text) ?
				`${text}: `:
				""
			;
		}
		this.tooltip.set_text(`${this.tooltipText}${text}`);
	}

	connectWithStream(stream) {
		// global.log(`connectWithStream::init`);
		this.actor.show();
		this.stream = stream;
		
		this._signals.disconnect("notify::is-muted");
		this._signals.disconnect("notify::volume");
		this._signals.connect(stream, "notify::is-muted", this._update, this, true);
		this._signals.connect(stream, "notify::volume", this._update, this, true);
		this._update();
		// global.log(`connectWithStream::done`);
	}

	_changeValue(step) {
		let value = this._value + step/this.volumeMax*this.volumeNorm;
		value = (step < 0) ?
			Math.max(0, value):
			Math.min(1, value)
		;
		this._slider.queue_repaint();

		let muted;
		let volume = Math.ceil( value * this.volumeMax);

		if(value < 0.005) {
				volume = 0;
				muted = true;
		} else {
				muted = false;
				//100% is magnetic:
				if (this.magneticOn === true && volume != this.volumeNorm && volume > this.volumeNorm*(1-VOLUME_ADJUSTMENT_STEP/2) && volume < this.volumeNorm*(1+VOLUME_ADJUSTMENT_STEP/2))
						volume = this.volumeNorm;
		}
		this.stream.volume = volume;
		this.stream.push_volume();
		this._value = value;
		// mute eh responsabilidade do applet
		if(this.stream.is_muted !== muted) {
			this.emit("toggle-mute", muted);
		}
	}

	_onScrollEvent(actor, event) {
		const direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.SMOOTH) {
            return Clutter.EVENT_PROPAGATE;
        }

		let step = 
			(direction == Clutter.ScrollDirection.UP) ?
			VOLUME_ADJUSTMENT_STEP:
			-VOLUME_ADJUSTMENT_STEP
		;
		this._changeValue(step);
	}

	_onKeyPressEvent(actor, event) {
		let key = event.get_key_symbol();
		let STEP = VOLUME_ADJUSTMENT_STEP/2;
		switch(key) {
			case Clutter.KEY_Left:
			case Clutter.KEY_AudioLowerVolume:
				STEP = -STEP;
			case Clutter.KEY_Right:
			case Clutter.KEY_AudioRaiseVolume:
				break;

			default:
				return false;
		}
		this._changeValue(STEP);
		this.emit('drag-end');
		return true;
	}

	_update() {
		// global.log(`_update::init`);
		// value: percentage of volume_max (set as value in the widget)
		// visible_value: percentage of volume_norm (shown to the user)
		// these only differ for the output, and only when the user changes the maximum volume
		let volume = (!this.stream || this.stream.is_muted) ? 0 : this.stream.volume;
		let value, visible_value, delta = VOLUME_ADJUSTMENT_STEP * this.volumeMax / this.volumeNorm;

		value = volume / this.volumeMax;
		visible_value = volume / this.volumeNorm;
		if (this.magneticOn === true && visible_value != 1 && visible_value > 1 - delta/2 && visible_value < 1 + delta/2) {
				visible_value = 1; // 100% is magnetic
				value = this.volumeNorm / this.volumeMax;
		}

		let percentage = Math.round(visible_value * 100) + "%";
		this.setTooltipText(percentage);
		this.emit("volume-changed", percentage);

		if (this._dragging) {
			this.tooltip.show();
		}
		this.setValue(value);
		// global.log(`_update::done`);
	}
}
module.exports = {VolumeSlider}