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

import * as nem from 'nem2-sdk'

// Parse the version field from the version/network type field.
const createVersionFromDTO = version =>
  parseInt(version.toString(16).substr(2, 2), 16)

const createUInt64FromDTO = uint64DTO =>
  nem.UInt64.fromNumericString(uint64DTO)

const createPublicAccountFromDTO = (publicKey, networkType) => {
  if (undefined === publicKey) {
    return undefined
  }
  return nem.PublicAccount.createFromPublicKey(publicKey, networkType)
}

// Create recipient from string or object which is a raw address or namespace ID.
const createRecipientFromDTO = recipient => {
  if (typeof recipient === 'string') {
    // Either a namespace ID or an address.
    // If least-significant bit of byte 0 is not set, then it is an
    // address, otherwise, it is a namespace ID.
    const byte0 = parseInt(recipient.substr(0, 2), 16)
    if ((byte0 & 0x1) === 0x1) {
      // Hex-encoded namespace ID
      return nem.NamespaceId.createFromEncoded(recipient.substr(1, 16))
    } else {
      // Hex-encoded address.
      return nem.Address.createFromEncoded(recipient)
    }
  } else if (typeof recipient === 'object') {
    // JSON object data.
    if (recipient.hasOwnProperty('address')) {
      // Base32-encoded address.
      return nem.Address.createFromRawAddress(recipient.address)
    } else if (recipient.hasOwnProperty('id')) {
      // Hex-encoded namespace ID
      return nem.NamespaceId.createFromEncoded(recipient.id)
    }
  }
  throw new Error(`recipient: ${recipient} type is not recognised`)
}

const isHexChar = char => {
  const zero = '0'.charCodeAt(0)
  const nine = '9'.charCodeAt(0)
  const lowera = 'a'.charCodeAt(0)
  const lowerf = 'f'.charCodeAt(0)
  const uppera = 'A'.charCodeAt(0)
  const upperf = 'F'.charCodeAt(0)

  let code = char.charCodeAt(0)
  if (code >= zero && code <= nine) {
    return true
  } else if (code >= lowera && code <= lowerf) {
    return true
  } else if (code >= uppera && code <= upperf) {
    return true
  }
  return false
}

const isHexString = str => {
  if (str.length % 2 !== 0) {
    return false
  }

  for (let i = 0; i < str.length; i++) {
    if (!isHexChar(str[i])) {
      return false
    }
  }
  return true
}

// Create message from data-transfer object.
const createMessageFromDTO = message => {
  if (message !== undefined) {
    const payload = message.payload
    if (message.type === nem.MessageType.PlainMessage) {
      if (isHexString(payload)) {
        return nem.PlainMessage.createFromPayload(payload)
      } else {
        return nem.PlainMessage.create(payload)
      }
    } else if (message.type === nem.MessageType.EncryptedMessage) {
      return nem.EncryptedMessage.createFromPayload(payload)
    } else if (message.type === nem.MessageType.PersistentHarvestingDelegationMessage) {
      return nem.PersistentHarvestingDelegationMessage.createFromPayload(payload)
    }
  }

  return nem.EmptyMessage
}

const createBlockFromDTO = (blockDTO, networkType) => {
  return new nem.BlockInfo(
    blockDTO.meta.hash,
    blockDTO.meta.generationHash,
    createUInt64FromDTO(blockDTO.meta.totalFee),
    blockDTO.meta.numTransactions,
    blockDTO.block.signature,
    createPublicAccountFromDTO(blockDTO.block.signerPublicKey, networkType),
    networkType,
    createVersionFromDTO(blockDTO.block.version),
    blockDTO.block.type,
    createUInt64FromDTO(blockDTO.block.height),
    createUInt64FromDTO(blockDTO.block.timestamp),
    createUInt64FromDTO(blockDTO.block.difficulty),
    blockDTO.block.feeMultiplier,
    blockDTO.block.previousBlockHash,
    blockDTO.block.blockTransactionsHash,
    blockDTO.block.blockReceiptsHash,
    blockDTO.block.stateHash,
    createPublicAccountFromDTO(blockDTO.block.beneficiaryPublicKey, networkType)
  )
}

const createMosaicFromDTO = (mosaicDTO) => {
  // If most-significant bit of byte 0 is not set, then it is an
  // namespace ID, otherwise, it is a mosaic ID.
  const byte0 = parseInt(mosaicDTO.id.substr(0, 2), 16)
  const amount = createUInt64FromDTO(mosaicDTO.amount)
  if ((byte0 & 0x80) === 0x80) {
    // Namespace ID
    const namespaceId = nem.NamespaceId.createFromEncoded(mosaicDTO.id)
    return new nem.Mosaic(namespaceId, amount)
  } else {
    // Mosaic ID
    const mosaicId = new nem.MosaicId(mosaicDTO.id)
    return new nem.Mosaic(mosaicId, amount)
  }
}

const createMosaicsFromDTO = (mosaics) => {
  if (mosaics === undefined) {
    return []
  } else {
    return mosaics.map(createMosaicFromDTO)
  }
}

const createMosaicInfoFromDTO = (mosaicInfoDTO, networkType) =>
  new nem.MosaicInfo(
    new nem.MosaicId(mosaicInfoDTO.mosaic.id),
    createUInt64FromDTO(mosaicInfoDTO.mosaic.supply),
    createUInt64FromDTO(mosaicInfoDTO.mosaic.startHeight),
    createPublicAccountFromDTO(mosaicInfoDTO.mosaic.ownerPublicKey, networkType),
    mosaicInfoDTO.mosaic.revision,
    new nem.MosaicFlags(mosaicInfoDTO.mosaic.flags),
    mosaicInfoDTO.mosaic.divisibility,
    createUInt64FromDTO(mosaicInfoDTO.mosaic.duration)
  )

const createNamespaceIdFromDTO = (namespaceIdDTO) =>
  nem.NamespaceId.createFromEncoded(namespaceIdDTO)

const extractLevels = (namespaceDTO) => {
  const result = []
  if (namespaceDTO.level0) {
    result.push(createNamespaceIdFromDTO(namespaceDTO.level0))
  }
  if (namespaceDTO.level1) {
    result.push(createNamespaceIdFromDTO(namespaceDTO.level1))
  }
  if (namespaceDTO.level2) {
    result.push(createNamespaceIdFromDTO(namespaceDTO.level2))
  }
  return result
}

const extractAlias = (namespaceDTO) => {
  if (namespaceDTO.alias && namespaceDTO.alias.type === nem.AliasType.Mosaic) {
    return new nem.Alias(nem.AliasType.Mosaic, undefined, namespaceDTO.alias.mosaicId)
  }
  else if (namespaceDTO.alias && namespaceDTO.alias.type === nem.AliasType.Address) {
    return new nem.Alias(nem.AliasType.Address, namespaceDTO.alias.address, undefined)
  }
  return new nem.Alias(nem.AliasType.None, undefined, undefined)
}

const createNamespaceInfoFromDTO = (namespaceInfoDTO, networkType) =>
  new nem.NamespaceInfo(
    namespaceInfoDTO.meta.active,
    namespaceInfoDTO.meta.index,
    namespaceInfoDTO.meta.id,
    namespaceInfoDTO.namespace.registrationType,
    namespaceInfoDTO.namespace.depth,
    extractLevels(namespaceInfoDTO.namespace),
    createNamespaceIdFromDTO(namespaceInfoDTO.namespace.parentId),
    createPublicAccountFromDTO(namespaceInfoDTO.namespace.ownerPublicKey, networkType),
    createUInt64FromDTO(namespaceInfoDTO.namespace.startHeight),
    createUInt64FromDTO(namespaceInfoDTO.namespace.endHeight),
    extractAlias(namespaceInfoDTO.namespace)
  )

const createTransactionFromDTO = (transactionDTO, networkType) =>
  nem.TransactionMapping.createFromDTO(transactionDTO)

export default {
  createBlockFromDTO,
  createMosaicInfoFromDTO,
  createNamespaceInfoFromDTO,
  createTransactionFromDTO
}
