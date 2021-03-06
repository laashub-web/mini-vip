import wepy from 'wepy'
import ODataClinet from '@/utils/odata_client'
import _ from 'underscore'
import {chatNewMessagePollingInterval} from '@/config'

class ChatAPI {

	unreadSubscriptions = [];

	_setInterval = null;

	//重置未读数量为0
	async resetUnread(related_to, user_id, space_id) {
		const queryOptions = {
			$top: 1,
			$filter: `(related_to/o eq '${related_to.object_name}') and (related_to/ids eq '${related_to.record_id}') and owner eq '${user_id}' and unread gt 0`,
			$select: '_id',
		};

		const result = await ODataClinet.query('chat_subscriptions', queryOptions, space_id);

		if (result.value.length > 0) {
			const sId = result.value[0]._id;
			ODataClinet.update('chat_subscriptions', sId, {unread: 0}, space_id)
		}
	}

	//定时接收通知
	receivingSubscriptions(user_id, space_id) {
		if (this._setInterval) {
			clearInterval(this._setInterval)
		}
		this._setInterval = setInterval(async () => {
			this.getRoomsSubscriptions(user_id, space_id).then(res => {
				const unreadSubscriptions = _.filter(res.value, (s) => {
					return s.unread > 0 && s.modified_by._id != user_id
				});
				this.unreadSubscriptions = unreadSubscriptions;

				//tab上显示小红点
				// if (unreadSubscriptions.length > 0) {
				// 	wx.showTabBarRedDot({index: 1})
				// } else {
				// 	wx.hideTabBarRedDot({index: 1})
				// }

				//tab上显示文字
				let unreadCount = 0;
				_.forEach(unreadSubscriptions, (unreadSubscription)=>{
					unreadCount = unreadCount + (unreadSubscription.unread || 0)
				});
				console.log('unreadCount', unreadCount)
				if (unreadCount > 0) {
					if(unreadCount > 999){
						unreadCount = 999
					}
					wx.setTabBarBadge({index: 1, text: unreadCount.toString()})
				} else {
					wx.removeTabBarBadge({index: 1})
				}

			})
		}, chatNewMessagePollingInterval || 15 * 1000)
	}

	getRoomsSubscriptions(user_id, space_id) {
		let queryOptions = {
			$filter: `(related_to/o eq 'chat_rooms') and owner eq '${user_id}'`,
			$select: 'last_message_text,unread,modified_by,related_to',
			$expand: 'modified_by($select=name,avatarUrl)'
		};
		return ODataClinet.query('chat_subscriptions', queryOptions, space_id)
	}

	async getRoom(user_id, space, room_members) {
		let filter = [];

		_.forEach(room_members, (m) => {
			filter.push(`(members eq '${m}')`)
		});

		let queryOptions = {
			$filter: `(type eq 'private') and (${filter.join(' and ')})`,
			$select: '_id,name',
		};

		const room = await ODataClinet.query('chat_rooms', queryOptions, space);

		console.log('getRoom room', room);
		if (room.value.length > 0) {
			return room.value[0]
		} else {

			const room_data = {
				type: 'private',
				name: '',
				owner: user_id,
				members: room_members
			};
			const insert_room = await ODataClinet.insert('chat_rooms', room_data, space);
			console.log('getRoom insert_room', insert_room);
			if (insert_room.value.length > 0) {
				return insert_room.value[0]
			}
			;
		}
	}

	sendMsg(related_to, msg, type = 'text', space, user_id) {
		return this.msg(related_to, msg, type, space, user_id);
	}

	getHistory(related_to, space, top, filter) {

		let queryOptions = {
			$top: top || 15,
			$filter: `(related_to/o eq '${related_to.object_name}') and (related_to/ids eq '${related_to.record_id}')`,
			$orderby: 'created desc',
			$select: 'name,type,created,owner',
			$expand: 'owner($select=name,avatarUrl)'
		};

		if (filter) {
			queryOptions.$filter = `${queryOptions.$filter} and ${filter}`
		}

		return ODataClinet.query('chat_messages', queryOptions, space)
	}

	getNewMessage(related_to, space, timestamp) {
		let queryOptions = {
			$filter: `(related_to/o eq '${related_to.object_name}') and (related_to/ids eq '${related_to.record_id}')`,
			$orderby: 'created desc',
			$select: 'name,type,created,owner',
			$expand: 'owner($select=name,avatarUrl)'
		};

		if(timestamp){
			queryOptions.$filter = `(related_to/o eq '${related_to.object_name}') and (related_to/ids eq '${related_to.record_id}') and created gt ${timestamp}`;
		}

		return ODataClinet.query('chat_messages', queryOptions, space)
	}

	async msg(related_to, msg, type = 'text', space, user_id) {
		let data = {
			related_to: {
				o: related_to.object_name,
				ids: [related_to.record_id]
			},
			name: msg,
			type: 'text',
			owner: user_id
		};

		const res = await ODataClinet.insert('chat_messages', data, space);

		// data._id = res.value[0]._id;
		data = res.value[0];

		return data;

		// let history = wepy.getStorageSync('_wechat_history_') || m_history;
		// let msgObj = {
		//   to: to,
		//   msg: msg,
		//   type: type,
		//   from: frm,
		//   time: +new Date()
		// };
		//
		// history.push(msgObj);
		//
		// return new Promise((resolve, reject) => {
		//   wepy.setStorage({key: '_wechat_history_', data: history}).then(() => {
		//     resolve(msgObj);
		//   }).catch(reject);
		// });
	}

	getSubscription(related_to, space_id, user_id, select, expand){
		let queryOptions = {
			$filter: `(related_to/o eq '${related_to.object_name}') and (related_to/ids eq '${related_to.record_id}') and owner eq '${user_id}'`,
			$select: select
		};

		if(expand){
			queryOptions.$expand = expand;
		}

		return ODataClinet.query('chat_subscriptions', queryOptions, space_id)
	}
}

export default new ChatAPI()
