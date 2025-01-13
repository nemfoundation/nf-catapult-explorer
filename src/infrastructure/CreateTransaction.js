/*
 *
 * Copyright (c) 2019-present for symbol
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

import http from './http';
import { Constants } from '../config';
import helper from '../helper';
import { MosaicService, NamespaceService } from '../infrastructure';
import { Address, Convert, Mosaic, MosaicId } from 'symbol-sdk';

class CreateTransaction {
	static transferTransaction = async (
		transactionObj,
		{ mosaicInfos, mosaicNames, unresolvedMosaicsMap }
	) => {
		const { transactionInfo } = transactionObj;

		const [resolvedAddress] = await Promise.all([
			helper.resolvedAddress(
				transactionObj.recipientAddress,
				transactionInfo.height
			)
		]);

		const resolvedMosaics = transactionObj.mosaics.map(mosaic => {
			return new Mosaic(
				new MosaicId(unresolvedMosaicsMap[mosaic.id.toHex()]),
				mosaic.amount
			);
		});

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				message: transactionObj.message,
				recipient: resolvedAddress,
				mosaics: helper.mosaicsFieldObjectBuilder(
					resolvedMosaics,
					mosaicInfos,
					mosaicNames
				)
			}
		};
	};

	static namespaceRegistration = async transactionObj => {
		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				recipient: http.networkConfig.NamespaceRentalFeeSinkAddress.address,
				registrationType:
					Constants.NamespaceRegistrationType[transactionObj.registrationType],
				namespaceName: transactionObj.namespaceName,
				namespaceId: transactionObj.namespaceId.toHex(),
				parentId:
					'undefined' !== typeof transactionObj.parentId
						? transactionObj.parentId?.toHex()
						: Constants.Message.UNAVAILABLE,
				duration:
					'undefined' !== typeof transactionObj.duration
						? transactionObj.duration?.compact()
						: Constants.Message.UNLIMITED
			}
		};
	};

	static addressAlias = async transactionObj => {
		const namespaceNames = await NamespaceService.getNamespacesNames([
			transactionObj.namespaceId
		]);
		const namespaceName = namespaceNames.find(namespace => namespace.namespaceId === transactionObj.namespaceId.toHex());

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				aliasAction: Constants.AliasAction[transactionObj.aliasAction],
				namespaceId: transactionObj.namespaceId.toHex(),
				namespaceName: namespaceName.name,
				address: transactionObj.address.address
			}
		};
	};

	static mosaicAlias = async transactionObj => {
		const namespaceNames = await NamespaceService.getNamespacesNames([
			transactionObj.namespaceId
		]);
		const namespaceName = namespaceNames.find(namespace => namespace.namespaceId === transactionObj.namespaceId.toHex());

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				aliasAction: Constants.AliasAction[transactionObj.aliasAction],
				namespaceId: transactionObj.namespaceId.id.toHex(),
				namespaceName: namespaceName.name,
				mosaicId: transactionObj.mosaicId.id.toHex()
			}
		};
	};

	static mosaicDefinition = async (transactionObj, {
		unresolvedMosaicsMap
	}) => {

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				recipient: http.networkConfig.MosaicRentalSinkAddress.address,
				mosaicId: unresolvedMosaicsMap[transactionObj.mosaicId.toHex()],
				divisibility: transactionObj.divisibility,
				duration: transactionObj.duration.compact(),
				nonce: transactionObj.nonce.toHex(),
				supplyMutable: transactionObj.flags.supplyMutable,
				transferable: transactionObj.flags.transferable,
				restrictable: transactionObj.flags.restrictable,
				revokable: transactionObj.flags.revokable
			}
		};
	};

	static mosaicSupplyChange = async (transactionObj, {
		unresolvedMosaicsMap
	}) => {
		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				mosaicId: unresolvedMosaicsMap[transactionObj.mosaicId.toHex()],
				action: Constants.MosaicSupplyChangeAction[transactionObj.action],
				delta: transactionObj.delta.compact()
			}
		};
	};

	static mosaicSupplyRevocation = async (
		transactionObj,
		{ mosaicInfos, mosaicNames, unresolvedMosaicsMap }
	) => {
		const resolvedMosaics = [
			new Mosaic(
				new MosaicId(unresolvedMosaicsMap[transactionObj.mosaic.id.toHex()]),
				transactionObj.mosaic.amount
			)
		];

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				address: transactionObj.sourceAddress.address,
				mosaics: helper.mosaicsFieldObjectBuilder(
					resolvedMosaics,
					mosaicInfos,
					mosaicNames
				)
			}
		};
	};

	static multisigAccountModification = async transactionObj => {
		const { transactionInfo } = transactionObj;
		const [addressAdditions, addressDeletions] = await Promise.all([
			Promise.all(transactionObj.addressAdditions.map(address => {
				return helper.resolvedAddress(address, transactionInfo.height);
			})),
			Promise.all(transactionObj.addressDeletions.map(address => {
				return helper.resolvedAddress(address, transactionInfo.height);
			}))
		]);

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				minApprovalDelta: transactionObj.minApprovalDelta,
				minRemovalDelta: transactionObj.minRemovalDelta,
				addressAdditions: addressAdditions,
				addressDeletions: addressDeletions
			}
		};
	};

	static hashLock = async (
		transactionObj,
		{ mosaicInfos, mosaicNames, unresolvedMosaicsMap }
	) => {
		const resolvedMosaics = [
			new Mosaic(
				new MosaicId(unresolvedMosaicsMap[transactionObj.mosaic.id.toHex()]),
				transactionObj.mosaic.amount
			)
		];

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				duration: transactionObj.duration.compact(),
				mosaics: helper.mosaicsFieldObjectBuilder(
					resolvedMosaics,
					mosaicInfos,
					mosaicNames
				),
				hash: transactionObj.hash
			}
		};
	};

	static secretLock = async (
		transactionObj,
		{ mosaicInfos, mosaicNames, unresolvedMosaicsMap }
	) => {
		const { transactionInfo } = transactionObj;

		const [resolvedAddress] = await Promise.all([
			helper.resolvedAddress(
				transactionObj.recipientAddress,
				transactionInfo.height
			)
		]);

		const resolvedMosaics = [
			new Mosaic(
				new MosaicId(unresolvedMosaicsMap[transactionObj.mosaic.id.toHex()]),
				transactionObj.mosaic.amount
			)
		];

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				duration: transactionObj.duration.compact(),
				mosaics: helper.mosaicsFieldObjectBuilder(
					resolvedMosaics,
					mosaicInfos,
					mosaicNames
				),
				secret: transactionObj.secret,
				recipient: resolvedAddress,
				hashAlgorithm: Constants.LockHashAlgorithm[transactionObj.hashAlgorithm]
			}
		};
	};

	static secretProof = async transactionObj => {
		const { transactionInfo } = transactionObj;
		const resolvedAddress = await helper.resolvedAddress(
			transactionObj.recipientAddress,
			transactionInfo.height
		);

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				hashAlgorithm:
					Constants.LockHashAlgorithm[transactionObj.hashAlgorithm],
				recipient: resolvedAddress,
				secret: transactionObj.secret,
				proof: transactionObj.proof
			}
		};
	};

	static accountAddressRestriction = async transactionObj => {
		const { transactionInfo } = transactionObj;
		const [addressAdditions, addressDeletions] = await Promise.all([
			Promise.all(transactionObj.restrictionAdditions.map(address => {
				return helper.resolvedAddress(address, transactionInfo.height);
			})),
			Promise.all(transactionObj.restrictionDeletions.map(address => {
				return helper.resolvedAddress(address, transactionInfo.height);
			}))
		]);

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				restrictionType:
					Constants.AddressRestrictionFlag[transactionObj.restrictionFlags],
				restrictionAddressAdditions: addressAdditions,
				restrictionAddressDeletions: addressDeletions
			}
		};
	};

	static accountMosaicRestriction = async transactionObj => {
		// Todo: mosaic restriction field
		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				restrictionType:
					Constants.MosaicRestrictionFlag[transactionObj.restrictionFlags],
				restrictionMosaicAdditions: transactionObj.restrictionAdditions.map(restriction => restriction.id.toHex()),
				restrictionMosaicDeletions: transactionObj.restrictionDeletions.map(restriction => restriction.id.toHex())
			}
		};
	};

	static accountOperationRestriction = async transactionObj => {
		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				restrictionType:
					Constants.OperationRestrictionFlag[transactionObj.restrictionFlags],
				restrictionOperationAdditions: transactionObj.restrictionAdditions.map(operation => operation),
				restrictionOperationDeletions: transactionObj.restrictionDeletions.map(operation => operation)
			}
		};
	};

	static mosaicAddressRestriction = async (transactionObj, {
		mosaicNames,
		unresolvedMosaicsMap
	}) => {
		const { transactionInfo } = transactionObj;

		const targetAddress = await helper.resolvedAddress(
			transactionObj.targetAddress,
			transactionInfo.height
		);

		const mosaicAliasNames = MosaicService.extractMosaicNamespace({
			mosaicId: unresolvedMosaicsMap[transactionObj.mosaicId.toHex()]
		},mosaicNames);

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				mosaicId: unresolvedMosaicsMap[transactionObj.mosaicId.toHex()],
				mosaicAliasNames,
				targetAddress: targetAddress,
				restrictionKey: transactionObj.restrictionKey.toHex(),
				previousRestrictionValue:
					transactionObj.previousRestrictionValue.toString(),
				newRestrictionValue: transactionObj.newRestrictionValue.toString()
			}
		};
	};

	static mosaicGlobalRestriction = async transactionObj => {
		const referenceMosaicId =
			'0000000000000000' === transactionObj.referenceMosaicId.toHex()
				? transactionObj.mosaicId
				: transactionObj.referenceMosaicId;
		const mosaicAliasNames = await helper.getMosaicAliasNames(referenceMosaicId);

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				referenceMosaicId: referenceMosaicId.toHex(),
				mosaicAliasNames,
				restrictionKey: transactionObj.restrictionKey.toHex(),
				previousRestrictionType:
					Constants.MosaicRestrictionType[
						transactionObj.previousRestrictionType
					],
				previousRestrictionValue:
					transactionObj.previousRestrictionValue.compact(),
				newRestrictionType:
					Constants.MosaicRestrictionType[transactionObj.newRestrictionType],
				newRestrictionValue: transactionObj.newRestrictionValue.compact()
			}
		};
	};

	static accountMetadata = async transactionObj => {
		const { transactionInfo } = transactionObj;
		const resolvedAddress = await helper.resolvedAddress(
			transactionObj.targetAddress,
			transactionInfo.height
		);

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				scopedMetadataKey: transactionObj.scopedMetadataKey.toHex(),
				targetAddress: resolvedAddress,
				metadataValue: `${Convert.uint8ToHex(transactionObj.value)} (Text: ${Convert.uint8ToUtf8(transactionObj.value)})`,
				valueSizeDelta: transactionObj.valueSizeDelta
			}
		};
	};

	static mosaicMetadata = async (transactionObj, {
		mosaicNames,
		unresolvedMosaicsMap
	}) => {
		const { transactionInfo } = transactionObj;
		const resolvedAddress = await helper.resolvedAddress(
			transactionObj.targetAddress,
			transactionInfo.height
		);

		const mosaicAliasNames = MosaicService.extractMosaicNamespace({
			mosaicId: unresolvedMosaicsMap[transactionObj.targetMosaicId.toHex()]
		}, mosaicNames);

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				scopedMetadataKey: transactionObj.scopedMetadataKey.toHex(),
				targetMosaicId: unresolvedMosaicsMap[transactionObj.targetMosaicId.toHex()],
				targetMosaicAliasNames: mosaicAliasNames,
				targetAddress: resolvedAddress,
				metadataValue: `${Convert.uint8ToHex(transactionObj.value)} (Text: ${Convert.uint8ToUtf8(transactionObj.value)})`,
				valueSizeDelta: transactionObj.valueSizeDelta
			}
		};
	};

	static namespaceMetadata = async transactionObj => {
		const { transactionInfo } = transactionObj;
		const [namespaceName, resolvedAddress] = await Promise.all([
			NamespaceService.getNamespacesNames([transactionObj.targetNamespaceId]),
			helper.resolvedAddress(
				transactionObj.targetAddress,
				transactionInfo.height
			)
		]);

		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				scopedMetadataKey: transactionObj.scopedMetadataKey.toHex(),
				targetNamespaceId: transactionObj.targetNamespaceId.toHex(),
				namespaceName: namespaceName,
				targetAddress: resolvedAddress,
				metadataValue: `${Convert.uint8ToHex(transactionObj.value)} (Text: ${Convert.uint8ToUtf8(transactionObj.value)})`,
				valueSizeDelta: transactionObj.valueSizeDelta
			}
		};
	};

	static votingKeyLink = transactionObj => {
		return {
			...transactionObj,
			transactionBody: {
				linkAction: Constants.LinkAction[transactionObj.linkAction],
				linkedPublicKey: transactionObj.linkedPublicKey,
				linkedAccountAddress: Address.createFromPublicKey(
					transactionObj.linkedPublicKey,
					http.networkType
				).plain(),
				startEpoch: transactionObj.startEpoch,
				endEpoch: transactionObj.endEpoch
			}
		};
	};

	static vrfKeyLink = transactionObj => {
		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				linkAction: Constants.LinkAction[transactionObj.linkAction],
				linkedPublicKey: transactionObj.linkedPublicKey,
				linkedAccountAddress: Address.createFromPublicKey(
					transactionObj.linkedPublicKey,
					http.networkType
				).plain()
			}
		};
	};

	static nodeKeyLink = transactionObj => {
		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				linkAction: Constants.LinkAction[transactionObj.linkAction],
				linkedPublicKey: transactionObj.linkedPublicKey,
				linkedAccountAddress: Address.createFromPublicKey(
					transactionObj.linkedPublicKey,
					http.networkType
				).plain()
			}
		};
	};

	static accountKeyLink = transactionObj => {
		return {
			...transactionObj,
			transactionBody: {
				transactionType: transactionObj.type,
				linkAction: Constants.LinkAction[transactionObj.linkAction],
				linkedPublicKey: transactionObj.linkedPublicKey,
				linkedAccountAddress: Address.createFromPublicKey(
					transactionObj.linkedPublicKey,
					http.networkType
				).plain()
			}
		};
	};
}

export default CreateTransaction;
