/*
 *
 * Copyright (c) 2019-present for NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License ");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { Constants } from './config';
import {
	MosaicService,
	NamespaceService,
	ReceiptService
} from './infrastructure';
import http from './infrastructure/http';
import moment from 'moment';
import {
	Address,
	MosaicId,
	NamespaceId,
	NetworkType,
	NodeVersion,
	TransactionType,
	UInt64
} from 'symbol-sdk';
const Url = require('url-parse');

const getNetworkTypeAddressFormat = {
	[NetworkType.MAIN_NET]: 'nN',
	[NetworkType.MIJIN]: 'mM',
	[NetworkType.MIJIN_TEST]: 'sS',
	[NetworkType.TEST_NET]: 'tT',
	[NetworkType.PRIVATE_TEST]: 'vV',
	[NetworkType.PRIVATE]: 'pP'
};

class helper {
	static timeSince(interval) {
		if (1 < interval.years)
			return interval.years + ' years';
		else if (1 === interval.years)
			return interval.years + ' year';
		else if (1 < interval.days)
			return interval.days + ' days';
		else if (1 === interval.days)
			return interval.days + ' day';
		else if (1 < interval.hours)
			return interval.hours + ' hours';
		else if (1 === interval.hours)
			return interval.hours + ' hour';
		else if (1 < interval.minutes)
			return interval.minutes + ' min'; // ' minutes'
		else if (1 === interval.minutes)
			return interval.minutes + ' min'; // ' minute'
		else if (1 !== interval.seconds)
			return interval.seconds + ' sec'; // ' seconds'
		else
			return interval.seconds + ' sec'; // ' second'
	}

	static formatSeconds = _second => {
		let second = _second;

		if (!second && 0 !== second)
			return '';

		let d = 0;

		let h = 0;

		let m = 0;

		if (86400 < second) {
			d = Math.floor(second / 86400);
			second = second % 86400;
		}
		if (3600 < second) {
			h = Math.floor(second / 3600);
			second = second % 3600;
		}
		if (60 < second) {
			m = Math.floor(second / 60);
			second = second % 60;
		}
		let result = '';

		if (0 < m || 0 < h || 0 < d)
			result = `${m} m ${result}`;

		if (0 < h || 0 < d)
			result = `${h} h ${result}`;

		if (0 < d)
			result = `${d} d ${result}`;

		return result;
	};

	static isMosaicOrNamespaceId = str =>
		16 === str.length && /^[0-9a-fA-F]+$/.test(str);

	static isAccountPublicKey = str =>
		64 === str.length && str.match('^[A-z0-9]+$');

	static isAccountAddress = str =>
		39 === str.length &&
		str.match(`[${getNetworkTypeAddressFormat[http.networkType]}]` +
				'{1,1}[a-zA-Z0-9]{5,5}[a-zA-Z0-9]{6,6}[a-zA-Z0-9]{6,6}[a-zA-Z0-9]{6,6}[a-zA-Z0-9]{6,6}[a-zA-Z0-9]{6,6}[a-zA-Z0-9]{3,3}');

	static isBlockHeight = str => str.match(/^-{0,1}\d+$/);

	static validURL(url) {
		// All we expect is there is a valid origin for the url, IE,
		// the origin is not 'null'.
		return 'null' !== url.origin;
	}

	static parseUrl(str) {
		let url = new Url(str);

		if (this.validURL(url))
			return url;
	}

	static httpToWssUrl(str) {
		let url = new Url(str);

		if (this.validURL(url)) {
			url.set('protocol', '3000' === url.port ? 'ws:' : 'wss:');
			return url;
		}
	}

	static async logError(dispatch, action, ...args) {
		try {
			await dispatch(action, ...args);
		} catch (e) {
			console.error(`Failed to call ${action}`, e);
		}
	}

	static convertToSecond = durationInBlocks =>
		durationInBlocks * http.networkConfig.TargetBlockTime;

	static calculateNamespaceExpiration = (currentHeight, endHeight) => {
		const expired =
			currentHeight > endHeight - http.networkConfig.NamespaceGraceDuration;
		const expiredInBlock =
			endHeight - http.networkConfig.NamespaceGraceDuration - currentHeight;

		return {
			isExpired: expired,
			expiredInBlock: expiredInBlock,
			expiredInSecond: this.convertToSecond(expiredInBlock)
		};
	};

	static fetchData = async (fetchFunction, commit, before, error, success) => {
		if ('function' === typeof before) {
			await before();
		} else {
			commit('setLoading', true);
			commit('setError', false);
		}
		try {
			await fetchFunction();
		} catch (e) {
			if ('function' === typeof error) {
				await error(e);
			} else {
				console.error(e);
				commit('setError', true);
			}
		}
		if ('function' === typeof success)
			await success();
		else
			commit('setLoading', false);
	};

	/**
	 * Convert hex value or namespace name to mosaicId or namespaceId.
	 * @param {string} hexOrNamespace - hex value or namespace name.
	 * @param {string} toId - 'mosaic' | 'namespace'
	 * @returns {Promise<MosaicId|NamespaceId>} MosaicId | NamespaceId
	 */
	static hexOrNamespaceToId = async (hexOrNamespace, toId) => {
		let Id = MosaicId | NamespaceId;

		const isHexadecimal = this.isMosaicOrNamespaceId(hexOrNamespace);

		if (isHexadecimal) {
			Id =
				'mosaic' === toId
					? new MosaicId(hexOrNamespace)
					: NamespaceId.createFromEncoded(hexOrNamespace);
		} else {
			Id =
				'mosaic' === toId
					? await NamespaceService.getLinkedMosaicId(new NamespaceId(hexOrNamespace))
					: new NamespaceId(hexOrNamespace);
		}

		return Id;
	};

	/**
	 * Decode Account Public key or Namespace name to plan Address.
	 * @param {string} address Account publicKey string | namespace name
	 * @returns {Promise<string>} example : SB3KUBHATFCPV7UZQLWAQ2EUR6SIHBSBEOEDDDF3
	 */
	static decodeToAddress = async address => {
		if (this.isAccountPublicKey(address))
			return Address.createFromPublicKey(address, http.networkType).plain();

		if (!this.isAccountAddress(address)) {
			try {
				const namespaceId = new NamespaceId(address);

				return await NamespaceService.getLinkedAddress(namespaceId);
			} catch (e) {
				console.error(e);
			}
		}

		return address;
	};

	/**
	 * Convert Mosaic amount to relative Amount with divisibility.
	 * @param {number} amount - number
	 * @param {number} divisibility - decimal
	 * @returns {string} relativeAmount in string
	 */
	static formatMosaicAmountWithDivisibility = (amount, divisibility) => {
		if ('number' !== typeof amount)
			throw new Error('amount must be a number');

		let relativeAmount = amount / Math.pow(10, divisibility);

		return relativeAmount.toLocaleString('en-US', {
			minimumFractionDigits: divisibility
		});
	};

	/**
	 * Get network currency balance.
	 * @param {array} mosaics - formatted mosaics.
	 * @returns {string} network currency balance.
	 */
	static getNetworkCurrencyBalance = mosaics => {
		const networkCurrencyMosaic = mosaics.filter(mosaic =>
			mosaic.id.toHex() === http.networkCurrency.mosaicId ||
				(mosaic.id instanceof NamespaceId &&
					mosaic.id.toHex() === http.networkCurrency.namespaceId));

		const totalNetworkCurrencyAmount = networkCurrencyMosaic.reduce(
			(acc, cur) => acc + Number(cur.amount.toString()),
			0
		);

		return 0 < networkCurrencyMosaic.length
			? this.toNetworkCurrency(totalNetworkCurrencyAmount)
			: Constants.Message.UNAVAILABLE;
	};

	/**
	 * Convert networkTimestamp to date.
	 * @param {number} networkTimestamp network timestamp in seconds.
	 * @param {'UTC' | 'Local'} type time zone 'UTC' or 'Local'.
	 * @returns {string} Date with format YYYY-MM-DD HH:mm:ss.
	 */
	static convertTimestampToDate = (networkTimestamp, type = http.timezone) => {
		// moment using milliseconds as default
		const date = moment(networkTimestamp * 1000);

		switch (type) {
		case 'UTC':
			date.utc();
			break;

		case 'Local':
			date.local();
			break;
		}

		return date.format('YYYY-MM-DD HH:mm:ss');
	};

	/**
	 * convert difficulty raw score to readable
	 * @param {UInt64} difficulty - raw difficulty score
	 * @returns {string} difficulty - readable difficulty score
	 */
	static convertBlockDifficultyToReadable = difficulty =>
		(difficulty.compact() / 1000000000000).toFixed(2).toString();

	/**
	 * Format Importance score to percentage.
	 * @param {number} rawScore raw score.
	 * @returns {string} importance score in percentage.
	 */
	static ImportanceScoreToPercent = rawScore => {
		const totalChainImportance = http.networkConfig.TotalChainImportance;
		const { divisibility } = http.networkCurrency;

		let percent = rawScore;

		if (0 < rawScore)
			percent = rawScore / totalChainImportance;

		return (percent * 100).toFixed(divisibility).toString() + ' %';
	};

	/**
	 * Format number to Network currency divisibility.
	 * example transaction fees
	 * @param {number} amount - mosaic amount.
	 * @returns {string} amount - (string) with formatted divisibility
	 */
	static toNetworkCurrency = amount =>
		(amount / Math.pow(10, http.networkCurrency.divisibility)).toLocaleString(
			'en-US',
			{ minimumFractionDigits: http.networkCurrency.divisibility }
		);

	/**
	 * Convert public key to Address.
	 * @param {string} publicKey - raw public key
	 * @returns {string} address - address in plain format
	 */
	static publicKeyToAddress = publicKey =>
		Address.createFromPublicKey(publicKey, http.networkType).plain();

	/**
	 * convert network timestamp to world time
	 * @param {number} timestamp - raw timestamp
	 * @returns {number} timestamp - world timestamp
	 */
	static networkTimestamp = timestamp =>
		Math.round(timestamp / 1000) + http.networkConfig.NemsisTimestamp;

	/**
	 * Sort Native mosaic to top of list.
	 * @param {array} mosaics - array of mosaic.
	 * @returns {array} mosaic[] - sort array of mosaic.
	 */
	static sortMosaics = mosaics => {
		let sortedMosaics = [];

		mosaics.forEach(mosaic =>
			mosaic.mosaicId === http.networkCurrency.mosaicId
				? sortedMosaics.unshift(mosaic)
				: sortedMosaics.push(mosaic));

		return sortedMosaics;
	};

	/**
	 * Convert second to time from now in second.
	 * @param {number} second number of second.
	 * @returns {string} time from now in second.
	 */
	static convertTimeFromNowInSec = second =>
		moment.utc().add(second, 's').fromNow();

	/**
	 * convert second to Date.
	 * @param {number} second number of second.
	 * @returns {string} YYYY.MM.DD HH:mm UTC.
	 */
	static convertSecondToDate = second =>
		moment.utc().add(second, 's').format('YYYY.MM.DD @ HH:mm UTC');

	/**
	 * Converts an HSL color value to RGB. Conversion formula
	 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
	 * Assumes h, s, and l are contained in the set [0, 1] and
	 * returns r, g, and b in the set [0, 255].
	 *
	 * @param   {number}  h       The hue
	 * @param   {number}  s       The saturation
	 * @param   {number}  l       The lightness
	 * @returns {object} {R: Number, G: Number, B: Number}
	 */
	static hslToRgb(h, s, l) {
		let r, g, b;

		if (0 === s) {
			r = g = b = l;
		} // achromatic
		else {
			/* eslint-disable no-param-reassign */
			const hue2rgb = (_p, _q, _t) => {
				if (0 > _t)
					_t += 1;
				if (1 < _t)
					_t -= 1;
				if (_t < 1 / 6)
					return _p + ((_q - _p) * (6 * _t));
				if (_t < 1 / 2)
					return _q;
				if (_t < 2 / 3)
					return _p + ((_q - _p) * (((2 / 3) - _t) * 6));
				return _p;
			};
			/* eslint-disable no-param-reassign */

			const q = 0.5 > l ? (l * (1 + s)) : l + s - (l * s);

			const p = (2 * l) - q;

			r = hue2rgb(p, q, h + (1 / 3));
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - (1 / 3));
		}

		return {
			R: Math.round(r * 255),
			G: Math.round(g * 255),
			B: Math.round(b * 255)
		};
	}

	/**
	 * Get RGB color from hash.
	 * @param {string} hash - hash to be converted.
	 * @param {boolean} isHex - default true
	 * @returns {object} { R: Number, G: Number, B: Number }
	 */
	static getColorFromHash = (hash, isHex = true) => {
		const color = {
			R: 0,
			G: 0,
			B: 0
		};
		const spread = 100;
		const saturation = 0.9;
		const lightness = 0.8;

		let totalValue = 0;

		if ('string' !== typeof hash) {
			console.error('Failed to convert hash to color. Hash is not a String');
			return color;
		}
		if (3 > hash.length) {
			console.error('Failed to convert hash to color. Hash string length < 3');
			return color;
		}

		if (isHex) {
			for (const hex of hash)
				totalValue += parseInt(hex, 16);
		} else {
			const charset = [
				'0',
				'1',
				'2',
				'3',
				'4',
				'5',
				'6',
				'7',
				'8',
				'9',
				'a',
				'b',
				'c',
				'd',
				'e',
				'f',
				'g',
				'h',
				'i',
				'j',
				'k',
				'l',
				'm',
				'n',
				'o',
				'p',
				'q',
				'r',
				's',
				't',
				'u',
				'v',
				'w',
				'x',
				'y',
				'z'
			];

			for (const char of hash)
				totalValue += charset.indexOf(char.toLowerCase());
		}

		const k = Math.trunc(totalValue / spread);
		const offsetValue = totalValue - (spread * k);
		const hue = offsetValue / 100;

		return this.hslToRgb(hue, saturation, lightness);
	};

	static truncString(str, strLen = 4) {
		if ('string' === typeof str) {
			if (str.length > (strLen * 2) + 1)
				return `${str.substring(0, strLen)}...${str.substring(str.length - strLen, str.length)}`;
			return str;
		}
		console.error('Failed to trunc string. Provided value is not a string');
		return str;
	}

	/**
	 * Get plain address from unResolvedAddress Object
	 * @param {NamespaceId | Address} unResolvedAddress - NamespaceId | Address
	 * @param {number} blockHeight block height
	 * @returns {string} example : SB3KUBHATFCPV7UZQLWAQ2EUR6SIHBSBEOEDDDF3
	 */
	static resolvedAddress = async (unResolvedAddress, blockHeight) => {
		// Handle partial txs without block height
		if (!blockHeight) {
			if (unResolvedAddress instanceof NamespaceId)
				return unResolvedAddress.id.toHex();

			return unResolvedAddress.address;
		}

		if (!(unResolvedAddress instanceof NamespaceId))
			return unResolvedAddress.address;

		const searchCriteria = {
			height: UInt64.fromUint(blockHeight)
		};

		const namespaceHex = unResolvedAddress.id.toHex();

		const addressResolutionStatements =
			await ReceiptService.searchAddressResolutionStatements(searchCriteria);

		const address = addressResolutionStatements.data.find(item =>
			item.unresolved === namespaceHex && 'Address' === item.resolutionType)?.addressResolutionEntries[0];

		if (!address)
			throw new Error('Failed to resolved address');

		return address;
	};

	/**
	 * To resolved unresolvedMosaicId.
	 * @param {NamespaceId | MosaicId} unresolvedMosaicId - NamespaceId | MosaicId
	 * @param {object | undefined} transactionLocation Location of transaction for which to perform the resolution.
	 * @returns {MosaicId} MosaicId
	 */
	static resolveMosaicId = async (unresolvedMosaicId, transactionLocation = undefined) => {
		if (0n === (BigInt(`0x${unresolvedMosaicId.id.toHex()}`) & (1n << 63n)))
			return unresolvedMosaicId;

		if (unresolvedMosaicId.id.toHex() === http.networkCurrency.namespaceId)
			return new MosaicId(http.networkCurrency.mosaicId);

		if (!transactionLocation)
			return await NamespaceService.getLinkedMosaicId(unresolvedMosaicId);

		const searchCriteria = {
			height: UInt64.fromUint(transactionLocation.height)
		};

		const mosaicResolutionStatements =
			await ReceiptService.searchMosaicResolutionStatements(searchCriteria);

		const isReceiptSourceLessThanEqual = (lhs, rhs) =>
			lhs.primaryId < rhs.primaryId || (lhs.primaryId === rhs.primaryId && lhs.secondaryId <= rhs.secondaryId);

		for (const statement of mosaicResolutionStatements.data) {
			if (statement.unresolved === unresolvedMosaicId.id.toHex()) {
				for (const entry of statement.resolutionEntries) {
					if (isReceiptSourceLessThanEqual(entry.source, transactionLocation))
						return entry.resolved;
				}
			}
		}
	};

	/**
	 * Build mosaic field object use in MosaicField components.
	 * @param {array} resolvedMosaics - resolved mosaics.
	 * @param {array} mosaicInfos - mosaics info.
	 * @param {array} mosaicNames - mosaics namespace name.
	 * @returns {object} { mosaicId, amount, mosaicAliasName }
	 */
	static mosaicsFieldObjectBuilder = (
		resolvedMosaics,
		mosaicInfos,
		mosaicNames
	) => {
		if (0 === resolvedMosaics.length)
			return [];

		const uniqueMosaicIds = [
			...new Set(resolvedMosaics.map(mosaic => mosaic.id.toHex()))
		];

		return uniqueMosaicIds.map(idHex => {
			const mosaics = resolvedMosaics.filter(mosaic => mosaic.id.toHex() === idHex);

			const sumAmount = mosaics.reduce(
				(acc, cur) => acc + BigInt(cur.amount.toString()),
				BigInt(0)
			);

			const mosaicField = {
				rawAmount: UInt64.fromNumericString(sumAmount.toString()),
				mosaicId: idHex
			};

			if (idHex === http.networkCurrency.mosaicId) {
				return {
					...mosaicField,
					amount: this.formatMosaicAmountWithDivisibility(
						Number(sumAmount),
						http.networkCurrency.divisibility
					),
					mosaicAliasName: http.networkCurrency.namespaceName
				};
			} else {
				const { divisibility } = mosaicInfos.find(info => info.mosaicId === mosaics[0].id.toHex());

				return {
					...mosaicField,
					amount: this.formatMosaicAmountWithDivisibility(
						Number(sumAmount),
						divisibility
					),
					mosaicAliasName: MosaicService.extractMosaicNamespace(
						{ mosaicId: mosaics[0].id.toHex() },
						mosaicNames
					)[0]
				};
			}
		});
	};

	/**
	 * Check native namespace.
	 * @param {string} namespaceName - namespace name in string format.
	 * @returns {boolean} boolean
	 */
	static isNativeNamespace = namespaceName => {
		if (!http.nativeNamespaces)
			return false;

		const values = http.nativeNamespaces.map(namespace => namespace.namespaceName);

		return -1 !== values.indexOf(namespaceName);
	};

	/**
	 * Gets single mosaic alias name.
	 * @param {MosaicId} mosaicId mosaicId.
	 * @returns {array} mosaic alias name.
	 */
	static getMosaicAliasNames = async mosaicId => {
		const getMosaicNames = await NamespaceService.getMosaicsNames([mosaicId]);
		const mosaicAliasNames = MosaicService.extractMosaicNamespace(
			{ mosaicId: mosaicId.toHex() },
			getMosaicNames
		);

		return mosaicAliasNames;
	};

	static fallbackCopyTextToClipboard = text => {
		let textArea = document.createElement('textarea');

		let success = false;

		textArea.value = text;

		// Avoid scrolling to bottom
		textArea.style.top = '0';
		textArea.style.left = '0';
		textArea.style.position = 'fixed';

		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		try {
			success = document.execCommand('copy');
		} catch (err) {
			console.error('Fallback: Could not copy text', err);
		}

		document.body.removeChild(textArea);
		return success;
	};

	static copyTextToClipboard = text => {
		return new Promise((resolve, reject) => {
			if (!navigator.clipboard) {
				if (this.fallbackCopyTextToClipboard(text))
					resolve();
				else
					reject(Error('Could not copy text. document.execCommand() failed'));
			}
			navigator.clipboard.writeText(text).then(
				function () {
					resolve();
				},
				function (err) {
					console.error('Async: Could not copy text: ', err);
					reject(Error('Async: Could not copy text: ', err));
				}
			);
		});
	};

	static formatNodeVersion = rawNodeVersion => {
		try {
			return NodeVersion.createFromRawNodeVersion(rawNodeVersion).formatted();
		} catch (e) {
			return Constants.Message.UNAVAILABLE;
		}
	};

	static getMosaicName(mosaic) {
		let mosaicAliasName;

		if (Array.isArray(mosaic.mosaicAliasName))
		{mosaicAliasName = mosaic.mosaicAliasName.length
			? mosaic.mosaicAliasName[0]
			: 'N/A';}
		else
		{mosaicAliasName = mosaic.mosaicAliasName ? mosaic.mosaicAliasName : 'N/A';}

		return 'N/A' !== mosaicAliasName ? mosaicAliasName : mosaic.mosaicId;
	}

	/**
	 * Convert dataset into CSV format.
	 * @param {array} dataset - list of data.
	 * @returns {string} csv data in string format.
	 */
	static convertArrayToCSV(dataset) {
		if (!Array.isArray(dataset))
			throw Error('Convert dataset to CSV fail.');

		if (0 === dataset.length)
			return 'Nothing to show';

		let csvContent = '';

		csvContent += Object.keys(dataset[0]).join(',') + '\n';

		for (const value of dataset) {
			let row = '';

			for (let prop in value) {
				if ('' !== row)
					row += ',';

				row += value[prop];
			}

			csvContent += row + '\r\n';
		}

		return csvContent;
	}

	/**
	 * Gets first index from the list.
	 * @param {number} pageNumber number of page.
	 * @param {number} pageSize number of page size.
	 * @returns {number} first index from the list
	 */
	static getStartListIndex = (pageNumber, pageSize) => {
		return 1 === pageNumber ? 0 : (pageNumber - 1) * pageSize;
	};

	static getTransactionMosaicInfoAndNamespace = async transactionObject => {
		const unresolvedMosaics = [];

		const makeTransactionLocation = (transactionInfo, secondaryId = undefined) => {
			if (!transactionInfo?.height)
				return undefined;

			return {
				height: transactionInfo.height,
				primaryId: transactionInfo.index + 1,
				secondaryId: undefined === secondaryId ? 0 : secondaryId
			};
		};

		const addUnresolvedMosaic = (mosaicId, transactionLocation) => {
			unresolvedMosaics.push({
				mosaicId,
				transactionLocation
			});
		};

		const processTransaction = (transaction, transactionLocation) => {
			switch (transaction.type) {
			case TransactionType.TRANSFER:
				transaction.mosaics.forEach(mosaic => {
					addUnresolvedMosaic(mosaic.id, transactionLocation);
				});
				break;
			case TransactionType.MOSAIC_METADATA:
				addUnresolvedMosaic(transaction.targetMosaicId, transactionLocation);
				break;
			case TransactionType.MOSAIC_DEFINITION:
			case TransactionType.MOSAIC_SUPPLY_CHANGE:
				addUnresolvedMosaic(transaction.mosaicId, transactionLocation);
				break;
			case TransactionType.MOSAIC_SUPPLY_REVOCATION:
			case TransactionType.HASH_LOCK:
			case TransactionType.SECRET_LOCK:
				addUnresolvedMosaic(transaction.mosaic.id, transactionLocation);
				break;
			}
		};

		if (transactionObject.innerTransactions) {
			transactionObject.innerTransactions.forEach(innerTx => {
				processTransaction(
					innerTx,
					makeTransactionLocation(
						transactionObject.transactionInfo,
						innerTx.transactionInfo.index + 1
					)
				);
			});
		} else {
			processTransaction(
				transactionObject,
				makeTransactionLocation(transactionObject.transactionInfo)
			);
		}

		return await helper.getMosaicInfoAndNamespace(unresolvedMosaics);
	};

	static getMosaicInfoAndNamespace = async unresolvedMosaics => {
		const unresolvedMosaicsMap = {};

		// create resolved mosaic mapping
		const resolvedMosaics = await Promise.all(unresolvedMosaics.map(async ({mosaicId, transactionLocation}) => {
			const resolvedMosaicId = await helper.resolveMosaicId(mosaicId, transactionLocation);

			unresolvedMosaicsMap[mosaicId.toHex()] = resolvedMosaicId.toHex();

			return resolvedMosaicId;
		}));

		// skip networkCurrency mosaic
		const resolvedMosaicIds = resolvedMosaics
			.filter(mosaicId => mosaicId.toHex() !== http.networkCurrency.mosaicId);

		// filter duplicated mosaic id
		const uniqueMosaicIds = [
			...new Set(resolvedMosaicIds.map(mosaic => mosaic.toHex()))
		];

		let mosaicInfos = [];
		let mosaicNames = [];

		// Request mosaic namespace and mosaic info
		if (0 < uniqueMosaicIds.length) {
			[mosaicInfos, mosaicNames] = await Promise.all([
				MosaicService.getMosaics(uniqueMosaicIds.map(mosaic => new MosaicId(mosaic))),
				NamespaceService.getMosaicsNames(uniqueMosaicIds.map(mosaic => new MosaicId(mosaic)))
			]);
		}

		return {
			mosaicInfos,
			mosaicNames,
			unresolvedMosaicsMap
		};
	};
}

export default helper;
