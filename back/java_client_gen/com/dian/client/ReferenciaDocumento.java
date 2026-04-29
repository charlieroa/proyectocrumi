
package com.dian.client;

import javax.xml.bind.JAXBElement;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElementRef;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for ReferenciaDocumento complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType name="ReferenciaDocumento">
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="Descripcion" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="DocumentTypeId" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="DocumentTypeName" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="Emisor" type="{http://schemas.datacontract.org/2004/07/Entidad}Entidad" minOccurs="0"/>
 *         &lt;element name="Fecha" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="Receptor" type="{http://schemas.datacontract.org/2004/07/Entidad}Entidad" minOccurs="0"/>
 *         &lt;element name="UUID" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "ReferenciaDocumento", namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", propOrder = {
    "descripcion",
    "documentTypeId",
    "documentTypeName",
    "emisor",
    "fecha",
    "receptor",
    "uuid"
})
public class ReferenciaDocumento {

    @XmlElementRef(name = "Descripcion", namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> descripcion;
    @XmlElementRef(name = "DocumentTypeId", namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> documentTypeId;
    @XmlElementRef(name = "DocumentTypeName", namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> documentTypeName;
    @XmlElementRef(name = "Emisor", namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", type = JAXBElement.class, required = false)
    protected JAXBElement<Entidad> emisor;
    @XmlElementRef(name = "Fecha", namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> fecha;
    @XmlElementRef(name = "Receptor", namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", type = JAXBElement.class, required = false)
    protected JAXBElement<Entidad> receptor;
    @XmlElementRef(name = "UUID", namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> uuid;

    /**
     * Gets the value of the descripcion property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getDescripcion() {
        return descripcion;
    }

    /**
     * Sets the value of the descripcion property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setDescripcion(JAXBElement<String> value) {
        this.descripcion = value;
    }

    /**
     * Gets the value of the documentTypeId property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getDocumentTypeId() {
        return documentTypeId;
    }

    /**
     * Sets the value of the documentTypeId property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setDocumentTypeId(JAXBElement<String> value) {
        this.documentTypeId = value;
    }

    /**
     * Gets the value of the documentTypeName property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getDocumentTypeName() {
        return documentTypeName;
    }

    /**
     * Sets the value of the documentTypeName property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setDocumentTypeName(JAXBElement<String> value) {
        this.documentTypeName = value;
    }

    /**
     * Gets the value of the emisor property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public JAXBElement<Entidad> getEmisor() {
        return emisor;
    }

    /**
     * Sets the value of the emisor property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public void setEmisor(JAXBElement<Entidad> value) {
        this.emisor = value;
    }

    /**
     * Gets the value of the fecha property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getFecha() {
        return fecha;
    }

    /**
     * Sets the value of the fecha property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setFecha(JAXBElement<String> value) {
        this.fecha = value;
    }

    /**
     * Gets the value of the receptor property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public JAXBElement<Entidad> getReceptor() {
        return receptor;
    }

    /**
     * Sets the value of the receptor property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public void setReceptor(JAXBElement<Entidad> value) {
        this.receptor = value;
    }

    /**
     * Gets the value of the uuid property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getUUID() {
        return uuid;
    }

    /**
     * Sets the value of the uuid property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setUUID(JAXBElement<String> value) {
        this.uuid = value;
    }

}
