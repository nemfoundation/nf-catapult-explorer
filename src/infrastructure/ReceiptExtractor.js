import Constants from '../config/constants';
import helper from '../helper';
import { Mosaic, MosaicId, ReceiptType } from 'symbol-sdk';

class ReceiptExtractor {
	static balanceChangeReceipt = async transactionStatement => {
		let balanceChangeReceipt = [];

		const mosaics = transactionStatement.map(statement => ({
			mosaicId: statement.mosaicId,
			transactionLocation: undefined
		}));

		const { mosaicInfos, mosaicNames, unresolvedMosaicsMap } =
			await helper.getMosaicInfoAndNamespace(mosaics);

		for (const statement of transactionStatement) {
			balanceChangeReceipt.push({
				...statement,
				height: statement.height.compact(),
				receiptType: Constants.ReceiptType[statement.type],
				targetAddress: statement.targetAddress.plain(),
				mosaics: helper.mosaicsFieldObjectBuilder(
					[
						new Mosaic(
							new MosaicId(unresolvedMosaicsMap[statement.mosaicId.toHex()]),
							statement.amount
						)
					],
					mosaicInfos,
					mosaicNames
				)
			});
		}

		return balanceChangeReceipt;
	};

	static balanceTransferReceipt = async transactionStatement => {
		let balanceTransferReceipt = [];

		for (const statement of transactionStatement) {
			const mosaic = new Mosaic(statement.mosaicId, statement.amount);

			balanceTransferReceipt.push({
				...statement,
				height: statement.height.compact(),
				receiptType: Constants.ReceiptType[statement.type],
				senderAddress: statement.senderAddress.address,
				recipient: statement.recipientAddress.address,
				mosaics: helper.mosaicsFieldObjectBuilder([mosaic])
			});
		}

		return balanceTransferReceipt;
	};

	static inflationReceipt = async transactionStatement => {
		let inflationReceipt = [];

		for (const statement of transactionStatement) {
			const mosaic = new Mosaic(statement.mosaicId, statement.amount);

			inflationReceipt.push({
				...statement,
				height: statement.height.compact(),
				receiptType: Constants.ReceiptType[statement.type],
				mosaics: helper.mosaicsFieldObjectBuilder([mosaic])
			});
		}

		return inflationReceipt;
	};

	static artifactExpiryReceipt = async transactionStatement => {
		let artifactExpiryReceipt = [];

		for (const statement of transactionStatement) {
			let artifactObj = {
				...statement,
				height: statement.height.compact(),
				receiptType: Constants.ReceiptType[statement.type],
				artifactId: statement.artifactId.toHex()
			};

			if (ReceiptType.Mosaic_Expired === statement.type)
			{Object.assign(artifactObj, {
				mosaicArtifactId: statement.artifactId.toHex()
			});}
			else if (
				ReceiptType.Namespace_Expired === statement.type ||
				ReceiptType.Namespace_Deleted === statement.type
			)
			{Object.assign(artifactObj, {
				namespaceArtifactId: statement.artifactId.toHex()
			});}

			artifactExpiryReceipt.push(artifactObj);
		}

		return artifactExpiryReceipt;
	};
}

export default ReceiptExtractor;
